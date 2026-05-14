// modules/payment/payment.routes.js

import express from "express";
import {
  initiatePayment,
  confirmPayment,
} from "./payment.controller.js";
import { authenticate } from "../../middleware/userAuth.js";

const router = express.Router();

router.post("/initiate", authenticate, initiatePayment);
router.post("/confirm", authenticate, confirmPayment);

export default router;
