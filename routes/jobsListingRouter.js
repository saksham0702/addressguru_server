import express from "express";
import { validateStep } from "../middleware/validateStep.js";
import { jobStepSchemas } from "../validations/jobs.validator.js";
import {
  saveJobStep,
  getAllJobsWithPaginationAndFilters,
  getJobById,
  deleteJob,
  getAllJobsByUser,
  getLastJobCompanyDetails,
  updateJobStatus,
  getJobsByCategoryAndCity,
} from "../controller/jobsListing.Controller.js";
import upload from "../middleware/multerConfig.js";
import { authenticate } from "../middleware/userAuth.js";
import {
  getEducationLevels,
  getExperienceLevels,
  getJobTypes,
  getWorkModes,
  getNationalities,
  getLanguages,
  getJobBenefits,
  getCompanySizes,
  getMonthlySalaryRanges,
} from "../controller/jobMetadata.Controller.js";

const router = express.Router();

const jobUpload = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

router.get("/", (req, res) => {
  res.send(`
    <h1 style="text-align:center;">
      Welcome to AddressGuru UAE Backend JOB LISTING Router
    </h1>
  `);
});

router
  .route("/save-job/:step")
  .post(jobUpload, validateStep(jobStepSchemas), authenticate, saveJobStep)
  .put(jobUpload, validateStep(jobStepSchemas), authenticate, saveJobStep);

router.get("/get-all-jobs", getAllJobsWithPaginationAndFilters);
router.get("/get-jobs-by-user/", authenticate, getAllJobsByUser);
router.get("/get-job/:slug", getJobById);
router.delete("/delete-job/:slug", deleteJob);
router.get("/last-company-details", authenticate, getLastJobCompanyDetails);

router.get("/get-listing-by-category-and-city/:category_slug/:city_slug", getJobsByCategoryAndCity);
router.put("/:id/status", authenticate, updateJobStatus);

// Meta Data Routes
router.get("/job-type", getJobTypes);
router.get("/work-mode", getWorkModes);
router.get("/experience-level", getExperienceLevels);
router.get("/education-level", getEducationLevels);
router.get("/nationality", getNationalities);
router.get("/language", getLanguages);
router.get("/job-benefit", getJobBenefits);
router.get("/company-size", getCompanySizes);
router.get("/monthly-salary", getMonthlySalaryRanges);

export default router;
