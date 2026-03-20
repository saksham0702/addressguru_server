// ─── routes/plan.routes.js ────────────────────────────────────────────────────
import express from "express";
import {
  getAllPlans,
  getPlanBySlug,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  seedDefaultPlans,
} from "../controller/plans.Controller.js";
import { authenticate } from "../middleware/userAuth.js";
// import { isAdmin } from "../middleware/roleAuth.js"; // ← uncomment when you add admin role guard

const router = express.Router();

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// GET  /plans                  → all active plans (for frontend pricing page)
router.get("/", getAllPlans);

// GET  /plans/slug/:slug        → single plan by slug  e.g. /plans/slug/growth
router.get("/slug/:slug", getPlanBySlug);

// GET  /plans/:id               → single plan by mongo id
router.get("/:id", getPlanById);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────
// Add authenticate + isAdmin middleware when your role system is ready.
// For now authenticate is used as a guard so random users can't call these.

// POST  /plans/seed             → one-time seed of 4 default UAE plans
router.post("/seed"/*, isAdmin */, seedDefaultPlans);

// POST  /plans                  → create a new plan
router.post("/",    /*, isAdmin */ createPlan);

// PUT   /plans/:id              → update a plan
router.put("/:id", /*, isAdmin */ updatePlan); 
// DELETE /plans/:id             → soft-delete a plan
router.delete("/:id", /*, isAdmin */ deletePlan);

export default router;