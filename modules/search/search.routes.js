import express from "express";
import { searchListingsController } from "./search.controller.js";

const router = express.Router();

router.get("/", searchListingsController);

export default router;
