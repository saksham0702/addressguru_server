import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  downloadSampleTemplate,
  previewAudience,
  createCampaign,
  getCampaigns,
  getCampaignById,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  retryFailedRecipients,
  deleteCampaign,
} from "./whatsappBulk.controller.js";

const router = Router();

// In-memory multer for excel and media uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 35 * 1024 * 1024 }, // 35 MB limit
});

// Sample template download
router.get("/sample-template", downloadSampleTemplate);

// Audience preview
router.post(
  "/preview-audience",
  upload.single("excelFile"),
  previewAudience
);

// Campaign CRUD & Controls
router.get("/campaigns", getCampaigns);
router.get("/campaigns/:id", getCampaignById);
router.post(
  "/campaigns",
  upload.fields([
    { name: "excelFile", maxCount: 1 },
    { name: "mediaFile", maxCount: 1 },
  ]),
  createCampaign
);
router.post("/campaigns/:id/start", startCampaign);
router.post("/campaigns/:id/pause", pauseCampaign);
router.post("/campaigns/:id/resume", resumeCampaign);
router.post("/campaigns/:id/cancel", cancelCampaign);
router.post("/campaigns/:id/retry-failed", retryFailedRecipients);
router.delete("/campaigns/:id", deleteCampaign);

export default router;
