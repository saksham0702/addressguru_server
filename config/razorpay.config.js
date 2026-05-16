import Razorpay from "razorpay";
import crypto from "crypto";

/*
|--------------------------------------------------------------------------
| RAZORPAY INSTANCE
|--------------------------------------------------------------------------
|
| This is the main Razorpay SDK instance.
| Used for:
| - creating orders
| - fetching payments
| - refunds (future)
|
*/

export const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/*
|--------------------------------------------------------------------------
| PAYMENT CURRENCY
|--------------------------------------------------------------------------
|
| Your platform uses AED.
|
*/

export const PAYMENT_CURRENCY = "AED";

/*
|--------------------------------------------------------------------------
| CONVERT TO SMALLEST SUBUNIT
|--------------------------------------------------------------------------
|
| Razorpay accepts smallest currency unit.
|
| Example:
| 299 AED -> 29900
|
*/

export const convertToSubunits = (amount) => {
  return Math.round(Number(amount) * 100);
};

/*
|--------------------------------------------------------------------------
| GENERATE RECEIPT ID
|--------------------------------------------------------------------------
|
| Internal tracking receipt.
| Visible inside Razorpay dashboard.
|
*/

export const generateReceipt = () => {
  return `rcpt_${Date.now()}`;
};

/*
|--------------------------------------------------------------------------
| VERIFY PAYMENT SIGNATURE
|--------------------------------------------------------------------------
|
| Used after frontend payment success.
|
| Verifies that payment really came from Razorpay.
|
*/

export const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  const body = `${orderId}|${paymentId}`;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
};

/*
|--------------------------------------------------------------------------
| VERIFY WEBHOOK SIGNATURE
|--------------------------------------------------------------------------
|
| Used when Razorpay sends webhook events.
|
| IMPORTANT:
| webhook requires RAW BODY
|
*/

export const verifyWebhookSignature = (rawBody, signature) => {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
};
