import express from "express";
import {
  createField,
  getFields,
  getField,
  updateField,
  deleteField
} from "../controller/additionalField.Controller.js";
import authenticate from "../middleware/userAuth.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router = express.Router();

router.post("/create-field", authenticate, verifyAdmin, createField);
router.get("/get-fields", authenticate, getFields);
// router.get("/get-field/:id", getField);
router.put("/update-field/:id", authenticate, verifyAdmin, updateField);
router.delete("/delete-field/:id", authenticate, verifyAdmin, deleteField);

export default router;