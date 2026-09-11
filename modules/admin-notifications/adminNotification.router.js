import express from "express";
import { getAdminBadgeCounts } from "./adminNotification.controller.js";

const router = express.Router();

// GET /admin-notifications/badge-counts
router.get("/badge-counts", getAdminBadgeCounts);

export default router;
