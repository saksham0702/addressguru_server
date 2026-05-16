import {
  createOrderService,
  verifyPaymentService,
  handleWebhookService,
} from "./payment.service.js";

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

    const { order, payment } = await createOrderService({
      userId: req.user.id,
      planId: plan_id,
      listingId: listing_id,
    });

    return res.status(200).json({
      success: true,

      data: {
        payment_id: payment._id,

        order_id: order.id,

        amount: order.amount,

        currency: order.currency,

        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
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
