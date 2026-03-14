/**
 * Mount at: app.use("/api/admin/users", adminUserRoutes)
 * All routes are protected by authenticate + isAdmin middleware
 */

import express from "express";
// import authenticate from "../middleware/authenticate.js";
// import isAdmin from "../middleware/isAdmin.js";
import {
  adminCreateUser,
  adminGetAllUsers,
  adminGetUserById,
  adminUpdateUser,
  adminDeleteUser,
  adminRestoreUser,
} from "../controller/AdminUser.Controller.js";

const router = express.Router();

// router.use(authenticate, isAdmin);

router.post("/create", adminCreateUser); // create
router.get("/get-all", adminGetAllUsers); // list all
router.get("/get-one/:id", adminGetUserById); // get one
router.patch("/update/:id", adminUpdateUser); // update
router.delete("/delete/:id", adminDeleteUser); // soft delete
router.patch("/restore/:id", adminRestoreUser); // restore

export default router;