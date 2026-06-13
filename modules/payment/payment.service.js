import Payment from "./payment.schema.js";
import Plan from "../../model/plansSchema.js";
import BusinessListing from "../../model/businessListingSchema.js";
import Job from "../../model/jobsListingSchema.js";
import MarketplaceListing from "../../model/marketplaceListingSchema.js";

import {
  razorpayInstance,
  PAYMENT_CURRENCY,
  convertToSubunits,
  generateReceipt,
  verifyPaymentSignature,
} from "../../config/razorpay.config.js";

/*
|--------------------------------------------------------------------------
| HELPER: UPDATE LISTING ON PAYMENT
|--------------------------------------------------------------------------
*/

const updateListingOnPayment = async (listingId, planId, planType) => {
  if (!listingId || !planId || !planType) return;

  let model;
  switch (planType) {
    case "business":
      model = BusinessListing;
      break;
    case "job":
      model = Job;
      break;
    case "marketplace":
      model = MarketplaceListing;
      break;
    default:
      return;
  }

  try {
    await model.findByIdAndUpdate(listingId, {
      plan: planId,
      isPublished: true,
      status: "pending",
    });
    console.log(`✅ Listing ${listingId} (${planType}) updated successfully`);
  } catch (err) {
    console.warn(`❌ Failed to update listing ${listingId}:`, err.message);
  }
};

/*
|--------------------------------------------------------------------------
| CREATE ORDER
|--------------------------------------------------------------------------
*/

export const createOrderService = async ({
  userId,
  planId,
  listingId = null,
}) => {
  /*
  |--------------------------------------------------------------------------
  | FIND PLAN
  |--------------------------------------------------------------------------
  */

  const plan = await Plan.findById(planId);

  if (!plan) {
    throw new Error("Plan not found");
  }

  /*
  |--------------------------------------------------------------------------
  | HANDLE FREE PLAN
  |--------------------------------------------------------------------------
  */

  if (plan.price === 0) {
    const payment = await Payment.create({
      user: userId,

      plan: plan._id,

      listing: listingId,

      planSnapshot: {
        name: plan.name,
        slug: plan.slug,
        price: plan.price,
        billingCycle: plan.billingCycle,
        features: plan.features,
      },

      amount: 0,

      amountInSubunits: 0,

      currency: PAYMENT_CURRENCY,

      status: "captured",

      paidAt: new Date(),

      notes: {
        planType: plan.planType,
        isFreePlan: true,
      },
    });

    return {
      isFreePlan: true,
      payment,
      order: null,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | PREVENT DUPLICATE PENDING PAYMENTS
  |--------------------------------------------------------------------------
  */

  const existingPayment = await Payment.findOne({
    user: userId,
    plan: planId,
    listing: listingId,
    status: "created",
  });

  if (existingPayment) {
    return {
      isFreePlan: false,

      payment: existingPayment,

      order: {
        id: existingPayment.razorpay.orderId,
        amount: existingPayment.amountInSubunits,
        currency: existingPayment.currency,
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | CREATE RAZORPAY ORDER
  |--------------------------------------------------------------------------
  */

  const amountInSubunits = convertToSubunits(plan.price);

  const receipt = generateReceipt();

  const order = await razorpayInstance.orders.create({
    amount: amountInSubunits,

    currency: PAYMENT_CURRENCY,

    receipt,

    notes: {
      userId: userId.toString(),
      planId: plan._id.toString(),
      planName: plan.name,
    },
  });

  /*
  |--------------------------------------------------------------------------
  | CREATE LOCAL PAYMENT RECORD
  |--------------------------------------------------------------------------
  */

  const payment = await Payment.create({
    user: userId,

    plan: plan._id,

    listing: listingId,

    planSnapshot: {
      name: plan.name,
      slug: plan.slug,
      price: plan.price,
      billingCycle: plan.billingCycle,
      features: plan.features,
    },

    amount: plan.price,

    amountInSubunits,

    currency: PAYMENT_CURRENCY,

    receipt,

    razorpay: {
      orderId: order.id,
    },

    notes: {
      planType: plan.planType,
    },
  });

  return {
    isFreePlan: false,
    order,
    payment,
  };
};

/*
|--------------------------------------------------------------------------
| VERIFY PAYMENT
|--------------------------------------------------------------------------
|
| This ONLY verifies frontend signature.
| Real success still depends on webhook.
|
*/

export const verifyPaymentService = async ({
  orderId,
  paymentId,
  signature,
}) => {
  /*
  |--------------------------------------------------------------------------
  | VERIFY PAYMENT SIGNATURE
  |--------------------------------------------------------------------------
  */
  if (!orderId || !paymentId || !signature) {
    throw new Error("Invalid payment verification request");
  }

  const isValid = verifyPaymentSignature({
    orderId,
    paymentId,
    signature,
  });

  if (!isValid) {
    throw new Error("Invalid payment signature");
  }

  /*
  |--------------------------------------------------------------------------
  | FIND PAYMENT
  |--------------------------------------------------------------------------
  */

  const payment = await Payment.findOne({
    "razorpay.orderId": orderId,
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  /*
  |--------------------------------------------------------------------------
  | PREVENT DUPLICATE PROCESSING
  |--------------------------------------------------------------------------
  */

  if (payment.status === "captured") {
    return payment;
  }

  /*
  |--------------------------------------------------------------------------
  | SAVE PAYMENT DETAILS
  |--------------------------------------------------------------------------
  */

  payment.razorpay.paymentId = paymentId;

  payment.razorpay.signature = signature;

  /*
  |--------------------------------------------------------------------------
  | TEMPORARY SUCCESS
  |--------------------------------------------------------------------------
  |
  | Since webhook is not configured yet,
  | we are marking payment captured here.
  |
  | REMOVE THIS LATER WHEN WEBHOOK IS ACTIVE
  |
  */

  payment.status = "captured";

  payment.paidAt = new Date();

  await payment.save();

  // ✅ Automagically update listing
  if (payment.listing && payment.plan) {
    await updateListingOnPayment(
      payment.listing,
      payment.plan,
      payment.notes?.planType || "business",
    );
  }

  return payment;
};
/*
|--------------------------------------------------------------------------
| HANDLE WEBHOOK
|--------------------------------------------------------------------------
|
| THIS IS THE REAL SOURCE OF TRUTH
|
*/

export const handleWebhookService = async (webhookBody) => {
  const { event, payload } = webhookBody;

  /*
  |--------------------------------------------------------------------------
  | PAYMENT CAPTURED
  |--------------------------------------------------------------------------
  */

  if (event === "payment.captured") {
    const paymentEntity = payload.payment.entity;

    const payment = await Payment.findOne({
      "razorpay.orderId": paymentEntity.order_id,
    });

    if (!payment) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | PREVENT DUPLICATE WEBHOOK PROCESSING
    |--------------------------------------------------------------------------
    */

    if (payment.status === "captured") {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE PAYMENT
    |--------------------------------------------------------------------------
    */

    payment.status = "captured";

    payment.paidAt = new Date();

    payment.webhookEvent = event;

    payment.razorpay.paymentId = paymentEntity.id;

    payment.razorpay.method = paymentEntity.method || null;

    payment.razorpay.email = paymentEntity.email || null;

    payment.razorpay.contact = paymentEntity.contact || null;

    payment.razorpay.international = paymentEntity.international || false;

    await payment.save();

    // ✅ Automagically update listing
    if (payment.listing && payment.plan) {
      await updateListingOnPayment(
        payment.listing,
        payment.plan,
        payment.notes?.planType || "business",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | UPGRADE LISTING HERE
    |--------------------------------------------------------------------------
    |
    | Example:
    |
    | listing.isFeatured = true
    |
    */
  }

  /*
  |--------------------------------------------------------------------------
  | PAYMENT FAILED
  |--------------------------------------------------------------------------
  */

  if (event === "payment.failed") {
    const paymentEntity = payload.payment.entity;

    const payment = await Payment.findOne({
      "razorpay.orderId": paymentEntity.order_id,
    });

    if (!payment) {
      return;
    }

    payment.status = "failed";

    payment.failedAt = new Date();

    payment.webhookEvent = event;

    payment.failureReason = paymentEntity.error_description || "Payment failed";

    payment.razorpay.paymentId = paymentEntity.id;

    await payment.save();
  }
};

// invoices
export const getAllPaymentsService = async ({
  userId,
  isAdmin,
  page = 1,
  limit = 10,
  status,
  search,
}) => {
  const skip = (page - 1) * limit;
  const filter = {};

  // Non-admin sees only their own
  if (!isAdmin) {
    filter.user = userId;
  }

  if (status && status !== "all") {
    filter.status = status;
  }

  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [
      { "razorpay.orderId": regex },
      { "razorpay.paymentId": regex },
      { "planSnapshot.name": regex },
      { receipt: regex },
    ];
  }

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate("user", "name email")
      .populate("listing", "businessName slug")
      .populate("plan", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return {
    payments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};
