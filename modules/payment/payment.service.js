// modules/payment/payment.service.js

import Payment from "./payment.schema.js";

export const createPaymentRecord = async ({
  userId,
  listingType,
  listingId,
  plan,
}) => {
  return await Payment.create({
    user: userId,
    listingType,
    listingId,
    planId: plan._id,
    amount: plan.price,
    currency: plan.currency,
    status: "pending",
  });
};

export const markPaymentSuccess = async (paymentId, transactionId = null) => {
  return await Payment.findByIdAndUpdate(
    paymentId,
    {
      status: "success",
      transactionId,
    },
    { new: true },
  );
};

export const markPaymentFailed = async (paymentId) => {
  return await Payment.findByIdAndUpdate(
    paymentId,
    { status: "failed" },
    { new: true },
  );
};
