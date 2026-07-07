import { Router } from "express";
import { getLogs } from "./log.controller.js";

const router = Router();

router.get("/", getLogs);

export default router;
