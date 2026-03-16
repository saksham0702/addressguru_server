import express from "express";
import { validateStep } from "../middleware/validateStep.js";
import { jobStepSchemas } from "../validations/jobs.validator.js";
import {
  saveJobStep,
  getAllJobsWithPaginationAndFilters,
  getJobById,
  deleteJob,
} from "../controller/jobsListing.Controller.js";
import upload from "../middleware/multerConfig.js";
import authenticate from "../middleware/userAuth.js";

const router = express.Router();

const jobUpload = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

router
  .route("/save-job/:step")
  .post(jobUpload, validateStep(jobStepSchemas), saveJobStep)
  .put(jobUpload, validateStep(jobStepSchemas), saveJobStep);

router.get("/get-all-jobs", getAllJobsWithPaginationAndFilters);
router.get("/get-job/:slug", getJobById);
router.delete("/delete-job/:slug", deleteJob);

export default router;
