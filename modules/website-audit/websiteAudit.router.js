import express from "express";
import {
  runAudit,
  getUserAudits,
  getAuditById,
  deleteAudit,
  getAdminAllAudits,
} from "./websiteAudit.controller.js";
import { authenticate } from "../../middleware/userAuth.js";

const router = express.Router();

// Run new audit (logged-in user only)
router.post("/run", authenticate, runAudit);

// Get current user's audits
router.get("/my-audits", authenticate, getUserAudits);

// Get single audit report by ID (owner or admin)
router.get("/report/:id", authenticate, getAuditById);

// Delete an audit (owner or admin)
router.delete("/:id", authenticate, deleteAudit);

// Admin: view all audits across all users
router.get("/admin/all", authenticate, getAdminAllAudits);

export default router;
