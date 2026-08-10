import Payment from "./payment.schema.js";
import Plan from "../../model/plansSchema.js";
import BusinessListing from "../../model/businessListingSchema.js";
import Job from "../../model/jobsListingSchema.js";
import MarketplaceListing from "../../model/marketplaceListingSchema.js";
import PropertyListing from "../../model/propertiesListingSchema.js"; // NEW

import {
  razorpayInstance,
  PAYMENT_CURRENCY,
  convertToSubunits,
  generateReceipt,
  verifyPaymentSignature,
} from "../../config/razorpay.config.js";

const MODEL_BY_PLAN_TYPE = {
  business: BusinessListing,
  job: Job,
  marketplace: MarketplaceListing,
  property: PropertyListing, // FIX: was missing entirely — property listings never got updated
};

/*
|--------------------------------------------------------------------------
| HELPER: UPDATE LISTING ON PAYMENT (or free-plan assignment)
|--------------------------------------------------------------------------
| Takes the FULL plan document (not just its id) because we need
| plan.durationInDays and plan.price to compute the expiry + status.
| plan._id itself is only ever read here, never mutated.
*/

export const updateListingOnPayment = async (
  listingId,
  plan,
  planType,
  ModelOverride = null,
) => {
  if (!listingId || !plan) return null;

  const model = ModelOverride || MODEL_BY_PLAN_TYPE[planType];
  if (!model) {
    console.warn(
      `⚠️ Unknown planType "${planType}" — listing ${listingId} not updated`,
    );
    return null;
  }

  const now = new Date();
  let planExpiryDate = null;
  let planStatus = "active";

  if (plan.price === 0) {
    // Free plan — never expires
    planStatus = "free";
    planExpiryDate = null;
  } else if (!plan.durationInDays || plan.durationInDays <= 0) {
    // Paid plan with no duration set = lifetime/no expiry
    planStatus = "active";
    planExpiryDate = null;
  } else {
    planStatus = "active";
    planExpiryDate = new Date(
      now.getTime() + plan.durationInDays * 24 * 60 * 60 * 1000,
    );
  }

  try {
    const updated = await model.findByIdAndUpdate(
      listingId,
      {
        plan: plan._id, // unchanged — plan reference is never disturbed
        isPublished: true,
        status: "pending",
        planStartedAt: now,
        planExpiryDate,
        planStatus,
      },
      { new: true },
    );
    console.log(
      `✅ Listing ${listingId} (${planType}) updated — status: ${planStatus}, expires: ${planExpiryDate}`,
    );
    return updated;
  } catch (err) {
    console.warn(`❌ Failed to update listing ${listingId}:`, err.message);
    return null;
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
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error("Plan not found");

  /* FREE PLAN */
  if (plan.price === 0) {
    const payment = await Payment.create({
      user: userId,
      plan: plan._id,
      listing: listingId,
      planSnapshot: {
        name: plan.name,
        slug: plan.slug,
        price: plan.price,
        actualPrice: plan.actualPrice, // NEW
        discountPercentage: plan.discountPercentage, // NEW
        durationInDays: plan.durationInDays, // NEW
        billingCycle: plan.billingCycle,
        features: plan.features,
      },
      amount: 0,
      amountInSubunits: 0,
      currency: PAYMENT_CURRENCY,
      status: "captured",
      paidAt: new Date(),
      notes: { planType: plan.planType, isFreePlan: true },
    });

    // FIX: previously the free-plan branch never touched the listing at
    // all — createPayment() could be called with plan_id of a free plan
    // and nothing would happen to the listing. Now it does, immediately,
    // since status is already "captured" for free plans.
    if (listingId) {
      await updateListingOnPayment(listingId, plan, plan.planType);
    }

    return { isFreePlan: true, payment, order: null };
  }

  /* PREVENT DUPLICATE PENDING PAYMENTS */
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

  /* CREATE RAZORPAY ORDER */
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

  const payment = await Payment.create({
    user: userId,
    plan: plan._id,
    listing: listingId,
    planSnapshot: {
      name: plan.name,
      slug: plan.slug,
      price: plan.price,
      actualPrice: plan.actualPrice, // NEW
      discountPercentage: plan.discountPercentage, // NEW
      durationInDays: plan.durationInDays, // NEW
      billingCycle: plan.billingCycle,
      features: plan.features,
    },
    amount: plan.price,
    amountInSubunits,
    currency: PAYMENT_CURRENCY,
    receipt,
    razorpay: { orderId: order.id },
    notes: { planType: plan.planType },
  });

  return { isFreePlan: false, order, payment };
};

/*
|--------------------------------------------------------------------------
| VERIFY PAYMENT (frontend signature check — temporary until webhook live)
|--------------------------------------------------------------------------
*/

export const verifyPaymentService = async ({
  orderId,
  paymentId,
  signature,
}) => {
  if (!orderId || !paymentId || !signature) {
    throw new Error("Invalid payment verification request");
  }

  const isValid = verifyPaymentSignature({ orderId, paymentId, signature });
  if (!isValid) throw new Error("Invalid payment signature");

  const payment = await Payment.findOne({ "razorpay.orderId": orderId });
  if (!payment) throw new Error("Payment not found");

  if (payment.status === "captured") {
    return { payment, listing: null };
  }

  payment.razorpay.paymentId = paymentId;
  payment.razorpay.signature = signature;
  payment.status = "captured";
  payment.paidAt = new Date();
  await payment.save();

  let listing = null;
  if (payment.listing && payment.plan) {
    const plan = await Plan.findById(payment.plan); // need durationInDays/price, not just the id
    listing = await updateListingOnPayment(
      payment.listing,
      plan,
      payment.notes?.planType || plan?.planType || "business",
    );
  }

  return { payment, listing };
};

/*
|--------------------------------------------------------------------------
| HANDLE WEBHOOK — real source of truth
|--------------------------------------------------------------------------
*/

export const handleWebhookService = async (webhookBody) => {
  const { event, payload } = webhookBody;

  if (event === "payment.captured") {
    const paymentEntity = payload.payment.entity;
    const payment = await Payment.findOne({
      "razorpay.orderId": paymentEntity.order_id,
    });
    if (!payment) return;
    if (payment.status === "captured") return;

    payment.status = "captured";
    payment.paidAt = new Date();
    payment.webhookEvent = event;
    payment.razorpay.paymentId = paymentEntity.id;
    payment.razorpay.method = paymentEntity.method || null;
    payment.razorpay.email = paymentEntity.email || null;
    payment.razorpay.contact = paymentEntity.contact || null;
    payment.razorpay.international = paymentEntity.international || false;
    await payment.save();

    if (payment.listing && payment.plan) {
      const plan = await Plan.findById(payment.plan);
      await updateListingOnPayment(
        payment.listing,
        plan,
        payment.notes?.planType || plan?.planType || "business",
      );
    }
  }

  if (event === "payment.failed") {
    const paymentEntity = payload.payment.entity;
    const payment = await Payment.findOne({
      "razorpay.orderId": paymentEntity.order_id,
    });
    if (!payment) return;

    payment.status = "failed";
    payment.failedAt = new Date();
    payment.webhookEvent = event;
    payment.failureReason = paymentEntity.error_description || "Payment failed";
    payment.razorpay.paymentId = paymentEntity.id;
    await payment.save();
  }
};

// getAllPaymentsService unchanged — keep yours as-is
export const getAllPaymentsService = async ({
  userId,
  isAdmin,
  page = 1,
  limit = 10,
  status,
  search,
  minAmount,
}) => {
  const skip = (page - 1) * limit;
  const filter = {};
  if (!isAdmin) filter.user = userId;
  if (status && status !== "all") filter.status = status;
  if (minAmount) filter.amount = { $gt: parseFloat(minAmount) };
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
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};
