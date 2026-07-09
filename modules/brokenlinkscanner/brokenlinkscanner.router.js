// brokenlinkscanner.routes.js
import express from "express";
import {
  triggerScan,
  getBrokenLinks,
  getScanStatus,
} from "./brokenlinkscanner.controller.js";

const router = express.Router();

router.post("/scan", triggerScan);
router.get("/", getBrokenLinks);
router.get("/status", getScanStatus);

export default router;
