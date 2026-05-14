// modules/payment/payment.controller.js

import Plan from "../../model/plansSchema.js";
import { createPaymentRecord } from "./payment.service.js";
import { successData, errorData } from "../../services/helper.js";
import Payment from "../modules/payment/payment.schema.js";
import { markPaymentSuccess } from "../modules/payment/payment.service.js";
import BusinessListing from "../../model/businessListingSchema.js";
import MarketplaceListing from "../../model/marketplaceListingSchema.js";
import PropertyListing from "../../model/propertiesListingSchema.js";
import JobListing from "../../model/jobsListingSchema.js";

export const initiatePayment = async (req, res) => {
  try {
    const { plan_id, listing_id, type } = req.body;

    const plan = await Plan.findById(plan_id);
    if (!plan) return errorData(res, 404, false, "Plan not found");

    const payment = await createPaymentRecord({
      userId: req.user.id,
      listingType: type,
      listingId: listing_id,
      plan,
    });

    // 🔥 For now: simulate payment
    return successData(res, 200, true, "Payment initiated", {
      payment_id: payment._id,
      amount: plan.price,
      status: payment.status,
    });
  } catch (err) {
    console.log(err);
    return errorData(res, 500, false, "Payment init failed");
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { payment_id } = req.body;

    const payment = await Payment.findById(payment_id);
    if (!payment) return errorData(res, 404, false, "Payment not found");

    // mark success
    await markPaymentSuccess(payment_id);

    // 🔥 APPLY PLAN BASED ON TYPE
    let Model;

    if (payment.listingType === "BUSINESS") Model = BusinessListing;
    else if (payment.listingType === "MARKETPLACE") Model = MarketplaceListing;
    else if (payment.listingType === "PROPERTIES") Model = PropertyListing;
    else if (payment.listingType === "JOBS") Model = JobListing;

    const listing = await Model.findById(payment.listingId);
    if (!listing) return errorData(res, 404, false, "Listing not found");

    listing.plan = payment.planId;
    listing.paymentStatus = "paid";
    listing.isPublished = true;

    await listing.save();

    return successData(res, 200, true, "Payment successful & plan applied", {
      listing_id: listing._id,
      plan: payment.planId,
    });
  } catch (err) {
    console.log(err);
    return errorData(res, 500, false, "Payment confirmation failed");
  }
};
