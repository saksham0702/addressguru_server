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
import {  authenticate }  from "../middleware/userAuth.js";
const router = express.Router();
//Public
// Used by the frontend RoomsSection to load all room cards for a listing page
router.get("/get-rooms-by-listing/:listingId", getRoomsByListing);

// Single room detail (for a "View room" modal / page)
router.get("/get-room/:roomId", getRoomById);

// Protected (business owner)
router.post("/create-room", authenticate, createRoom);
router.put("/update-room/:roomId", authenticate, updateRoom);
router.delete("/delete-room/:roomId", authenticate, deleteRoom);
router.patch("/toggle-room/:roomId", authenticate, toggleRoomStatus);

export default router;
