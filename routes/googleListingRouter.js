import express from "express";
import { googleSearch } from "../controller/googleListing.Controller.js";

const router = express.Router();

router.post("/google-search", googleSearch);

export default router;