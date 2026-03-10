import express from "express";
import {
  createField,
  getFields,
  getField,
  updateField,
  deleteField
} from "../controller/additionalField.Controller.js";

const router = express.Router();

router.post("/create-field", createField);
router.get("/get-fields", getFields);
// router.get("/get-field/:id", getField);
router.put("/update-field/:id", updateField);
router.delete("/delete-field/:id", deleteField);

export default router;