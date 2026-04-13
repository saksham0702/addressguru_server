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
    throw { status: 403, message: "You are not authorised to manage this listing's rooms." };

  return listing;
}

function buildTypeSpecificPayload(categoryType, body) {
  if (categoryType === "Hotel") {
    return {
      hotel: {
        checkIn: body.checkIn ?? null,
        checkOut: body.checkOut ?? null,
      },
    };
  }

  if (categoryType === "Hostel") {
    return {
      hostel: {
        checkIn: body.checkIn ?? null,
        checkOut: body.checkOut ?? null,
      },
    };
  }

  if (categoryType === "Yoga Studio") {
    return {
      yoga: {
        batchSize: body.batchSize ?? null,
        language: body.language ?? null,
        daysNights: body.daysNights ?? null,
        mealsIncluded: body.mealsIncluded ?? false,
      },
    };
  }

  return {};
}

// ─── CONTROLLERS ──────────────────────────────────────────────────────────────

export const createRoom = async (req, res) => {
  try {
    const userId = req.user.id;
    const { listingId, roomType, price, capacity, images } = req.body;

    if (!listingId || !roomType || price == null || !capacity) {
      return errorData(res, 400, false, "listingId, roomType, price, and capacity are required.");
    }

    const listing = await assertOwnership(listingId, userId);
    const categoryType = listing.category?.name;

    if (!ALLOWED_TYPES.includes(categoryType)) {
      return errorData(
        res,
        400,
        false,
        `Rooms are only supported for: ${ALLOWED_TYPES.join(", ")}.`
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
        "You can only add a maximum of 4 rooms per listing."
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
      images: images ?? [],
      ...typeSpecific,
    });

    return successData(res, 201, true, "Room created successfully.", room);
  } catch (err) {
    if (err.status) return errorData(res, err.status, false, err.message);
    console.error("createRoom:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// ─────────────────────────────────────────────────────────────

export const getRoomsByListing = async (req, res) => {
  try {
    const { listingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return errorData(res, 400, false, "Invalid listing ID.");
    }

    const rooms = await Room.find({
      businessListing: listingId,
      isActive: true,
      isDeleted: false,
    }).sort({ createdAt: 1 });

    if (!rooms.length) {
      return successData(res, 200, true, "No rooms found for this listing.", []);
    }

    const categoryType = rooms[0].categoryType;
    const startingFrom = Math.min(...rooms.map((r) => r.price));

    let meta = {};
    if (categoryType === "Yoga Studio") {
      const first = rooms[0];
      meta = {
        daysNights: first.yoga?.daysNights ?? null,
        batchSize: first.yoga?.batchSize ?? null,
        language: first.yoga?.language ?? null,
      };
    } else {
      const first = rooms[0];
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
      images: r.images,
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

// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────

export const updateRoom = async (req, res) => {
  try {
    const userId = req.user.id;

    const room = await Room.findOne({ _id: req.params.roomId, isDeleted: false });
    if (!room) return errorData(res, 404, false, "Room not found.");

    await assertOwnership(room.businessListing, userId);

    const { roomType, price, capacity, images, isActive } = req.body;

    if (roomType !== undefined) room.roomType = roomType;
    if (price !== undefined) room.price = price;
    if (capacity !== undefined) room.capacity = capacity;
    if (images !== undefined) room.images = images;
    if (isActive !== undefined) room.isActive = isActive;

    const typeSpecific = buildTypeSpecificPayload(room.categoryType, req.body);

    if (typeSpecific.hotel) Object.assign(room.hotel, typeSpecific.hotel);
    if (typeSpecific.hostel) Object.assign(room.hostel, typeSpecific.hostel);
    if (typeSpecific.yoga) Object.assign(room.yoga, typeSpecific.yoga);

    await room.save();

    return successData(res, 200, true, "Room updated successfully.", room);
  } catch (err) {
    if (err.status) return errorData(res, err.status, false, err.message);
    console.error("updateRoom:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};

// ─────────────────────────────────────────────────────────────

export const deleteRoom = async (req, res) => {
  try {
    const userId = req.user.id;

    const room = await Room.findOne({ _id: req.params.roomId, isDeleted: false });
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

    const room = await Room.findOne({ _id: req.params.roomId, isDeleted: false });
    if (!room) return errorData(res, 404, false, "Room not found.");

    await assertOwnership(room.businessListing, userId);

    room.isActive = !room.isActive;
    await room.save();

    return successData(
      res,
      200,
      true,
      `Room is now ${room.isActive ? "active" : "inactive"}.`,
      { isActive: room.isActive }
    );
  } catch (err) {
    if (err.status) return errorData(res, err.status, false, err.message);
    console.error("toggleRoomStatus:", err);
    return errorData(res, 500, false, "Internal server error.");
  }
};