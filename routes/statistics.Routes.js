import express from "express";
import { trackEvent, getUserOverview, getListingStats } from "../controller/statistics.Controller.js";
import { authenticate } from "../middleware/userAuth.js";


const router = express.Router();

// Public / Authenticated tracking endpoint
// We use an optional check so even guest views can be tracked if we want,
// but the controller handles req.user?.id
router.post("/:type/:slug/track", trackEvent);

// Protected routes for dashboard
router.get("/overview", authenticate, getUserOverview);
router.get("/listing/:type/:slug", authenticate, getListingStats);

export default router;
