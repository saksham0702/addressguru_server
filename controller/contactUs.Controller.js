import ContactUs from "../model/contactUsSchema.js";
import { successData, errorData } from "../services/helper.js";

// ─── POST /contact-us – Public Submission ─────────────────────────────────────
export const submitContactInquiry = async (req, res) => {
  try {
    const { name, email, countryCode = "+971", mobileNumber, subject, message } = req.body;

    if (!name || !name.trim()) {
      return errorData(res, 400, false, "Name is required");
    }

    if (!email || !email.trim()) {
      return errorData(res, 400, false, "Email is required");
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return errorData(res, 400, false, "Please enter a valid email address");
    }

    if (!mobileNumber || !String(mobileNumber).trim()) {
      return errorData(res, 400, false, "Mobile number is required");
    }

    if (!message || !message.trim()) {
      return errorData(res, 400, false, "Message is required");
    }

    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      null;
    const userAgent = req.headers["user-agent"] || null;

    const newInquiry = await ContactUs.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      countryCode: countryCode.trim(),
      mobileNumber: String(mobileNumber).trim(),
      subject: subject?.trim() || "General Inquiry",
      message: message.trim(),
      ipAddress,
      userAgent,
      status: "pending",
    });

    return successData(
      res,
      201,
      true,
      "Thank you for contacting us! We have received your message and will respond shortly.",
      newInquiry
    );
  } catch (error) {
    console.error("Submit contact inquiry error:", error);
    return errorData(res, 500, false, "Failed to submit inquiry. Please try again later.");
  }
};

// ─── GET /contact-us – Admin List with Search & Stats ─────────────────────────
export const getAllContactInquiries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search?.trim();

    const filter = { isDeleted: false };

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { mobileNumber: searchRegex },
        { subject: searchRegex },
        { message: searchRegex },
      ];
    }

    const [inquiries, total] = await Promise.all([
      ContactUs.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ContactUs.countDocuments(filter),
    ]);

    // Statistics across all non-deleted contacts
    const [totalAll, pendingCount, repliedCount, closedCount] = await Promise.all([
      ContactUs.countDocuments({ isDeleted: false }),
      ContactUs.countDocuments({ isDeleted: false, status: "pending" }),
      ContactUs.countDocuments({ isDeleted: false, status: "replied" }),
      ContactUs.countDocuments({ isDeleted: false, status: "closed" }),
    ]);

    return successData(res, 200, true, "Contact inquiries fetched successfully", {
      inquiries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
      statistics: {
        total: totalAll,
        pending: pendingCount,
        replied: repliedCount,
        closed: closedCount,
      },
    });
  } catch (error) {
    console.error("Get contact inquiries error:", error);
    return errorData(res, 500, false, "Failed to fetch contact inquiries");
  }
};

// ─── GET /contact-us/:id – Single Inquiry ─────────────────────────────────────
export const getContactInquiryById = async (req, res) => {
  try {
    const { id } = req.params;
    const inquiry = await ContactUs.findOne({ _id: id, isDeleted: false }).lean();

    if (!inquiry) {
      return errorData(res, 404, false, "Contact inquiry not found");
    }

    return successData(res, 200, true, "Inquiry fetched successfully", inquiry);
  } catch (error) {
    console.error("Get inquiry by id error:", error);
    return errorData(res, 500, false, "Failed to fetch inquiry");
  }
};

// ─── PATCH /contact-us/:id/status – Update Status & Notes ─────────────────────
export const updateContactInquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    const updateFields = {};
    if (status && ["pending", "replied", "closed"].includes(status)) {
      updateFields.status = status;
    }
    if (adminNote !== undefined) {
      updateFields.adminNote = adminNote;
    }

    const updated = await ContactUs.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return errorData(res, 404, false, "Contact inquiry not found");
    }

    return successData(res, 200, true, "Inquiry status updated successfully", updated);
  } catch (error) {
    console.error("Update inquiry status error:", error);
    return errorData(res, 500, false, "Failed to update inquiry status");
  }
};

// ─── DELETE /contact-us/:id – Soft Delete ─────────────────────────────────────
export const deleteContactInquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ContactUs.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!deleted) {
      return errorData(res, 404, false, "Contact inquiry not found");
    }

    return successData(res, 200, true, "Inquiry deleted successfully");
  } catch (error) {
    console.error("Delete inquiry error:", error);
    return errorData(res, 500, false, "Failed to delete inquiry");
  }
};

