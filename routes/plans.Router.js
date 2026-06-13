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
  upgradePlan,
} from "../controller/plans.Controller.js";
import { authenticate } from "../middleware/userAuth.js";
// import { isAdmin } from "../middleware/roleAuth.js"; // ← uncomment when you add admin role guard

const router = express.Router();

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// GET  /plans                  → all active plans (for frontend pricing page)
router.get("/get-all", getAllPlans);

// GET  /plans/slug/:slug        → single plan by slug  e.g. /plans/slug/growth
router.get("/slug/:slug", getPlanBySlug);

// GET  /plans/:id               → single plan by mongo id
router.get("/:id", getPlanById);

// POST /plans/upgrade           → upgrades listing plan (frontend)
router.post("/upgrade", authenticate, upgradePlan);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// POST  /plans/seed             → one-time seed of 4 default UAE plans
router.post("/seed", seedDefaultPlans);

// POST  /plans                  → create a new plan
router.post("/", authenticate, createPlan);

// PUT   /plans/:id              → update a plan
router.put("/:id", authenticate, updatePlan);
// DELETE /plans/:id             → soft-delete a plan
router.delete("/:id", authenticate, deletePlan);

export default router;
