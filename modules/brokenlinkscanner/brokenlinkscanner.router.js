// brokenlinkscanner.routes.js
import express from "express";
import {
  triggerScan,
  stopScan,
  getBrokenLinks,
  getScanStatus,
} from "./brokenlinkscanner.controller.js";

const router = express.Router();

router.post("/scan", triggerScan);
router.post("/stop", stopScan);
router.get("/", getBrokenLinks);
router.get("/status", getScanStatus);

export default router;
