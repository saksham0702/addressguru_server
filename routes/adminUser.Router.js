/**
 * Mount at: app.use("/api/admin/users", adminUserRoutes)
 * All routes are protected by authenticate + isAdmin middleware
 */

import express from "express";
import {
  adminCreateUser,
  adminGetAllUsers,
  adminGetUserById,
  adminUpdateUser,
  adminDeleteUser,
  adminRestoreUser,
} from "../controller/AdminUser.Controller.js";
import { getAdminStats } from "../controller/adminStats.Controller.js";
import { authenticate } from "../middleware/userAuth.js";
import { errorData } from "../services/helper.js";

const router = express.Router();

const requireAdminOrEditor = (req, res, next) => {
  const roles = req.user?.roles || (req.user?.role ? [Number(req.user.role)] : [5]);
  if (!roles.includes(1) && !roles.includes(2)) {
    return errorData(res, 403, false, "Access denied. Admin or Editor role required.");
  }
  next();
};

router.use(authenticate);
router.use(requireAdminOrEditor);

router.post("/create", adminCreateUser); // create
router.get("/get-all", adminGetAllUsers); // list all
router.get("/get-one/:id", adminGetUserById); // get one
router.patch("/update/:id", adminUpdateUser); // update
router.delete("/delete/:id", adminDeleteUser); // soft delete
router.patch("/restore/:id", adminRestoreUser); // restore
router.get("/statistics", getAdminStats);

export default router;
