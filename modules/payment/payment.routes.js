import express from "express";

import {
  createPayment,
  verifyPayment,
  razorpayWebhook,
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
