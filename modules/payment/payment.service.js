import Payment from "./payment.schema.js";
import Plan from "../../model/plansSchema.js";

import {
  razorpayInstance,
  PAYMENT_CURRENCY,
  convertToSubunits,
  generateReceipt,
  verifyPaymentSignature,
} from "../../config/razorpay.config.js";

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
