// routes/roomRoutes.js
import express from "express";
import {
  createRoom,
  getRoomsByListing,
  getRoomById,
  updateRoom,
  deleteRoom,
  toggleRoomStatus,
} from "../controller/rooms.Controller.js";
import { authenticate } from "../middleware/userAuth.js";
import upload from "../middleware/multerConfig.js";
import { setUploadFolder } from "../middleware/setUploadFolder.js";

const router = express.Router();

// Public
router.get("/get-rooms-by-listing/:listingId", getRoomsByListing);
router.get("/get-room/:roomId", getRoomById);

// ✅ Protected (ONLY HERE WE ADD MULTER)
router.post(
  "/create-room",
  authenticate,
  setUploadFolder("rooms"), // 🔥 separate folder (recommended)
  upload.array("images", 5), // 🔥 max 5 images
  createRoom,
);

router.put(
  "/update-room/:roomId",
  authenticate,
  setUploadFolder("rooms"),
  upload.array("images", 5),
  updateRoom,
);

router.delete("/delete-room/:roomId", authenticate, deleteRoom);
router.patch("/toggle-room/:roomId", authenticate, toggleRoomStatus);

export default router;
