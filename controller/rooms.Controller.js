import Room from "../model/roomsSchema.js";
import BusinessListing from "../model/businessListingSchema.js";
import mongoose from "mongoose";
import { successData, errorData } from "../services/helper.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ["Hotel", "Hostel", "Yoga Studio"];

async function assertOwnership(listingId, userId) {
  const listing = await BusinessListing.findOne({
    _id: listingId,
    isDeleted: false,
  }).populate("category", "name");

  if (!listing) throw { status: 404, message: "Business listing not found." };

  if (listing.createdBy.toString() !== userId.toString())
    throw {
      status: 403,
      message: "You are not authorised to manage this listing's rooms.",
    };

  return listing;
}

function buildTypeSpecificPayload(categoryType, body) {
  if (categoryType === "Hotel") {
    const src = body.hotel || body;
    return {
      hotel: {
        checkIn: src.checkIn ?? null,
        checkOut: src.checkOut ?? null,
      },
    };
  }

  if (categoryType === "Hostel") {
    const src = body.hostel || body;
    return {
      hostel: {
        checkIn: src.checkIn ?? null,
        checkOut: src.checkOut ?? null,
      },
    };
  }

  if (categoryType === "Yoga Studio") {
    const src = body.yoga || body;
    return {
      yoga: {
        batchSize: src.batchSize ?? null,
        language: src.language ?? null,
        daysNights: src.daysNights ?? null,
        mealsIncluded: src.mealsIncluded ?? false,
      },
    };
  }

  return {};
}

// ─── CONTROLLERS ──────────────────────────────────────────────────────────────
export const createRoom = async (req, res) => {
  console.log("req.files", req.files);
  console.log("req.body", req.body);
  try {
    const userId = req.user.id;
    const listingId = req.body.listingId || req.body.businessListing;
    const { roomType, price, capacity } = req.body;

    // 🔥 Handle images safely
    let images = [];

    // ONLY trust multer for files
    if (req.files && req.files.length > 0) {
      images = req.files.map((file) => file.path);
    }

    // ONLY allow URLs if explicitly sent as JSON (not FormData)
    if (!req.files?.length && typeof req.body.images === "string") {
      try {
        const parsed = JSON.parse(req.body.images);
        if (Array.isArray(parsed)) {
          images = parsed;
        }
      } catch {
        // ignore invalid JSON
      }
    }

    // 🔥 Limit to max 5 images (extra safety)
    if (images.length > 5) {
      return errorData(res, 400, false, "Maximum 5 images allowed.");
    }

    if (!listingId || !roomType || price == null || !capacity) {
      return errorData(
        res,
        400,
        false,
        "listingId, roomType, price, and capacity are required.",
      );
    }

    const listing = await assertOwnership(listingId, userId);
    const categoryType = listing.category?.name;

    if (!ALLOWED_TYPES.includes(categoryType)) {
      return errorData(
        res,
        400,
        false,
        `Rooms are only supported for: ${ALLOWED_TYPES.join(", ")}.`,
      );
    }

    const roomCount = await Room.countDocuments({
      businessListing: listingId,
      isDeleted: false,
    });

    if (roomCount >= 4) {
      return errorData(
        res,
        400,
        false,
        "You can only add a maximum of 4 rooms per listing.",
      );
    }

    const typeSpecific = buildTypeSpecificPayload(categoryType, req.body);

    const room = await Room.create({
      businessListing: listingId,
      categoryId: listing.category._id,
      categoryType,
      roomType,
      price,
      capacity,
      images, // ✅ clean usage
      ...typeSpecific,
    });

    return successData(res, 201, true, "Room created successfully.", room);
  } catch (err) {
    if (err.status) return errorData(res, err.status, false, err.message);
    console.error("createRoom:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// get rooms by listing
export const getRoomsByListing = async (req, res) => {
  try {
    const { listingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return errorData(res, 400, false, "Invalid listing ID.");
    }

    const rooms = await Room.find({
      businessListing: listingId,
      // isActive: true,
      isDeleted: false,
    }).sort({ createdAt: 1 });

    if (!rooms.length) {
      return successData(
        res,
        200,
        true,
        "No rooms found for this listing.",
        [],
      );
    }

    const categoryType = rooms[0].categoryType;

    // 🔥 safer starting price
    const prices = rooms
      .map((r) => r.price)
      .filter((p) => typeof p === "number");

    const startingFrom = prices.length ? Math.min(...prices) : 0;

    let meta = {};
    const first = rooms[0];

    if (categoryType === "Yoga Studio") {
      meta = {
        daysNights: first.yoga?.daysNights ?? null,
        batchSize: first.yoga?.batchSize ?? null,
        language: first.yoga?.language ?? null,
      };
    } else {
      const src = categoryType === "Hotel" ? first.hotel : first.hostel;

      meta = {
        checkIn: src?.checkIn ?? null,
        checkOut: src?.checkOut ?? null,
      };
    }

    const roomCards = rooms.map((r) => ({
      _id: r._id,
      roomType: r.roomType,
      price: r.price,
      capacity: r.capacity,

      // 🔥 ALWAYS safe array
      images: Array.isArray(r.images) ? r.images : [],

      isActive: r.isActive,

      ...(categoryType === "Hotel" && { hotel: r.hotel }),
      ...(categoryType === "Hostel" && { hostel: r.hostel }),
      ...(categoryType === "Yoga Studio" && { yoga: r.yoga }),
    }));

    return successData(res, 200, true, "Rooms fetched successfully.", {
      categoryType,
      startingFrom,
      rooms: roomCards,
      ...meta,
    });
  } catch (err) {
    console.error("getRoomsByListing:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// get room by id
export const getRoomById = async (req, res) => {
  try {
    const room = await Room.findOne({
      _id: req.params.roomId,
      isDeleted: false,
    }).populate("businessListing", "businessName slug");

    if (!room) return errorData(res, 404, false, "Room not found.");

    return successData(res, 200, true, "Room fetched successfully.", room);
  } catch (err) {
    console.error("getRoomById:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// update room
export const updateRoom = async (req, res) => {
  try {
    const userId = req.user.id;

    const room = await Room.findOne({
      _id: req.params.roomId,
      isDeleted: false,
    });
    if (!room) return errorData(res, 404, false, "Room not found.");

    await assertOwnership(room.businessListing, userId);

    const { roomType, price, capacity, isActive } = req.body;

    // 🔥 HANDLE IMAGES PROPERLY
    let updatedImages = [...room.images]; // default = keep old

    // 1. Get existing images from body (these are the ones the user kept)
    let keptImages = [];
    if (req.body.images) {
      try {
        const parsed = typeof req.body.images === 'string' 
          ? JSON.parse(req.body.images) 
          : req.body.images;
        
        if (Array.isArray(parsed)) {
          keptImages = parsed.filter(img => typeof img === 'string');
        } else if (typeof parsed === 'string') {
          keptImages = [parsed];
        }
      } catch (e) {
        // If it's not valid JSON, it might just be a single path or comma separated
        if (typeof req.body.images === 'string') {
          keptImages = req.body.images.split(',').filter(Boolean);
        }
      }
    }

    // 2. Get new files from multer
    let newFiles = [];
    if (req.files && req.files.length > 0) {
      newFiles = req.files.map((file) => file.path);
    }

    // 3. Combine if either is provided
    if (req.body.images !== undefined || newFiles.length > 0) {
      updatedImages = [...keptImages, ...newFiles];
    }

    // 🔥 Max 5 images check
    if (updatedImages.length > 5) {
      return errorData(res, 400, false, "Maximum 5 images allowed.");
    }

    // 🔥 Update basic fields
    if (roomType !== undefined) room.roomType = roomType;
    if (price !== undefined) room.price = price;
    if (capacity !== undefined) room.capacity = capacity;
    if (isActive !== undefined) room.isActive = isActive;

    // 🔥 Assign images
    room.images = updatedImages;

    // 🔥 Type specific fields
    const typeSpecific = buildTypeSpecificPayload(room.categoryType, req.body);

    if (typeSpecific.hotel) {
      room.hotel = { ...room.hotel.toObject(), ...typeSpecific.hotel };
    }
    if (typeSpecific.hostel) {
      room.hostel = { ...room.hostel.toObject(), ...typeSpecific.hostel };
    }
    if (typeSpecific.yoga) {
      room.yoga = { ...room.yoga.toObject(), ...typeSpecific.yoga };
    }

    await room.save();

    return successData(res, 200, true, "Room updated successfully.", room);
  } catch (err) {
    if (err.status) return errorData(res, err.status, false, err.message);
    console.error("updateRoom:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// delete room

export const deleteRoom = async (req, res) => {
  try {
    const userId = req.user.id;

    const room = await Room.findOne({
      _id: req.params.roomId,
      isDeleted: false,
    });
    if (!room) return errorData(res, 404, false, "Room not found.");

    await assertOwnership(room.businessListing, userId);

    room.isDeleted = true;
    await room.save();

    return successData(res, 200, true, "Room deleted successfully.", null);
  } catch (err) {
    if (err.status) return errorData(res, err.status, false, err.message);
    console.error("deleteRoom:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// ─────────────────────────────────────────────────────────────

export const toggleRoomStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const room = await Room.findOne({
      _id: req.params.roomId,
      isDeleted: false,
    });
    if (!room) return errorData(res, 404, false, "Room not found.");

    await assertOwnership(room.businessListing, userId);

    room.isActive = !room.isActive;
    await room.save();

    return successData(
      res,
      200,
      true,
      `Room is now ${room.isActive ? "active" : "inactive"}.`,
      { isActive: room.isActive },
    );
  } catch (err) {
    if (err.status) return errorData(res, err.status, false, err.message);
    console.error("toggleRoomStatus:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};
