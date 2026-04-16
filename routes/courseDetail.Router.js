import express from "express";
import {
  createCourseDetail,
  getCoursesByListingSlug,
  getCourseById,
  updateCourseDetail,
  deleteCourseDetail,
} from "../controller/courseDetail.Controller.js";
import { authenticate } from "../middleware/userAuth.js";

const router = express.Router();

// ✅ CREATE
router.post("/", authenticate, createCourseDetail);

// ✅ GET by listing slug
router.get("/listing/:slug", getCoursesByListingSlug);

// ✅ GET single
router.get("/:id", getCourseById);

// ✅ UPDATE
router.put("/:id", authenticate, updateCourseDetail);

// ✅ DELETE (soft)
router.delete("/:id", authenticate, deleteCourseDetail);

export default router;