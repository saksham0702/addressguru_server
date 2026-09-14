// backend/modules/whatsapp-template/whatsappTemplate.router.js
import { Router } from "express";
import {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  resetDefaultTemplates,
  getPlansPitchSummary,
} from "./whatsappTemplate.controller.js";
import { optionalAuth } from "../../middleware/userAuth.js";
import { setUploadFolder } from "../../middleware/setUploadFolder.js";
import upload from "../../middleware/multerConfig.js";

const router = Router();

router.get("/plans-pitch", getPlansPitchSummary);
router.post("/reset", optionalAuth, resetDefaultTemplates);

router.get("/", optionalAuth, getTemplates);
router.get("/:id", optionalAuth, getTemplateById);
router.post(
  "/",
  optionalAuth,
  setUploadFolder("whatsapp-templates"),
  upload.single("file"),
  createTemplate
);
router.put(
  "/:id",
  optionalAuth,
  setUploadFolder("whatsapp-templates"),
  upload.single("file"),
  updateTemplate
);
router.delete("/:id", optionalAuth, deleteTemplate);

export default router;
