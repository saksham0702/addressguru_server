import express from "express";
import {
  createField,
  getFields,
  getField,
  updateField,
  deleteField,
} from "../controller/additionalField.Controller.js";
import { authenticate } from "../middleware/userAuth.js";

const router = express.Router();

router.post("/create-field", authenticate, createField);
router.get("/get-fields", authenticate, getFields);
router.get("/get-field/:id", authenticate, getField);
router.put("/update-field/:id", authenticate, updateField);
router.delete("/delete-field/:id", authenticate, deleteField);

export default router;