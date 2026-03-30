import express from "express";
import {
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
} from "../controller/template.Controller.js";
import { authenticate } from "../middleware/userAuth.js";

const router = express.Router();

router.get("/", authenticate, getTemplates);
router.post("/add", authenticate, addTemplate);
router.put("/update/:id", authenticate, updateTemplate);
router.delete("/delete/:id", authenticate, deleteTemplate);

export default router;
