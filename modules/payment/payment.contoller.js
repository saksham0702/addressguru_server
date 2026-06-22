import {
  createOrderService,
  verifyPaymentService,
  handleWebhookService,
  getAllPaymentsService,
} from "./payment.service.js";
import User from "../../model/userSchema.js";

import { verifyWebhookSignature } from "../../config/razorpay.config.js";

/*
|--------------------------------------------------------------------------
| CREATE PAYMENT ORDER
|--------------------------------------------------------------------------
*/

export const createPayment = async (req, res) => {
  try {
    const { plan_id, listing_id = null } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        success: false,
        message: "Plan ID is required",
      });
    }

    const { order, payment, isFreePlan } = await createOrderService({
      userId: req.user.id,
      planId: plan_id,
      listingId: listing_id,
    });

    /*
    |--------------------------------------------------------------------------
    | FREE PLAN RESPONSE
    |--------------------------------------------------------------------------
    */

    if (isFreePlan) {
      return res.status(200).json({
        success: true,

        free_plan: true,

        data: {
          payment_id: payment._id,
        },
      });
    }

    /*
    |--------------------------------------------------------------------------
    | PAID PLAN RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,

      free_plan: false,

      data: {
        payment_id: payment._id,

        order_id: order.id,

        amount: order.amount,

        currency: order.currency,

        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.log("createPayment error", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| VERIFY PAYMENT
|--------------------------------------------------------------------------
*/

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification fields missing",
      });
    }

    const payment = await verifyPaymentService({
      orderId: razorpay_order_id,

      paymentId: razorpay_payment_id,

      signature: razorpay_signature,
    });

    return res.status(200).json({
      success: true,

      message: "Payment verified successfully",

      data: payment,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, minAmount } = req.query;

    const userId = req.user.id || req.user._id;

    // fetch roles from DB since JWT doesn't have them
    const user = await User.findById(userId).select("roles").lean();
    const isAdmin = user?.roles?.includes(1) ?? false;

    const data = await getAllPaymentsService({
      userId,
      isAdmin,
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      search,
      minAmount,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| RAZORPAY WEBHOOK
|--------------------------------------------------------------------------
*/

export const razorpayWebhook = async (req, res) => {
  try {
    /*
    |--------------------------------------------------------------------------
    | GET SIGNATURE
    |--------------------------------------------------------------------------
    */

    const signature = req.headers["x-razorpay-signature"];

    /*
    |--------------------------------------------------------------------------
    | RAW BODY REQUIRED
    |--------------------------------------------------------------------------
    */

    const rawBody = req.body.toString();

    /*
    |--------------------------------------------------------------------------
    | VERIFY WEBHOOK
    |--------------------------------------------------------------------------
    */

    const isValid = verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | PARSE EVENT
    |--------------------------------------------------------------------------
    */

    const webhookBody = JSON.parse(rawBody);

    /*
    |--------------------------------------------------------------------------
    | HANDLE WEBHOOK
    |--------------------------------------------------------------------------
    */

    await handleWebhookService(webhookBody);

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
