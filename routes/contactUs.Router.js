import express from "express";
import {
  submitContactInquiry,
  getAllContactInquiries,
  getContactInquiryById,
  updateContactInquiryStatus,
  deleteContactInquiry,
} from "../controller/contactUs.Controller.js";
import { authenticate, authorizeAdmin } from "../middleware/userAuth.js";

const router = express.Router();

// Public: submit contact inquiry from contact-us page
router.post("/", submitContactInquiry);

// Admin / Editor protected routes
router.get("/", authenticate, authorizeAdmin(1, 2), getAllContactInquiries);
router.get("/:id", authenticate, authorizeAdmin(1, 2), getContactInquiryById);
router.patch("/:id/status", authenticate, authorizeAdmin(1, 2), updateContactInquiryStatus);
router.delete("/:id", authenticate, authorizeAdmin(1, 2), deleteContactInquiry);

export default router;

