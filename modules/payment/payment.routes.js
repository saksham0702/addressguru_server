import express from "express";

import {
  createPayment,
  verifyPayment,
  razorpayWebhook,
  getAllPayments,
} from "./payment.contoller.js";

import { authenticate } from "../../middleware/userAuth.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| USER ROUTES
|--------------------------------------------------------------------------
*/

router.post("/create-order", authenticate, createPayment);

router.post("/verify-payment", authenticate, verifyPayment);

router.get("/get-payments", authenticate, getAllPayments);

/*
|--------------------------------------------------------------------------
| WEBHOOK
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Use express.raw ONLY here
|
*/

router.post(
  "/webhook",

  express.raw({
    type: "application/json",
  }),

  razorpayWebhook,
);

export default router;
