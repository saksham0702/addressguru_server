import WebsiteAudit from "./websiteAudit.model.js";
import { executeWebsiteAudit } from "./websiteAudit.service.js";
import { successData, errorData } from "../../services/helper.js";

function getUserId(req) {
  return req.user?._id || req.user?.id;
}

function isUserAdmin(req) {
  const user = req.user;
  if (!user) return false;
  if (Array.isArray(user.roles) && user.roles.includes(1)) return true;
  if (user.role === 1 || user.role === "1") return true;
  return false;
}

// ─── RUN AUDIT (Logged-in users) ────────────────────────────────────────────
export const runAudit = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return errorData(res, 401, false, "Please log in to run a website audit.");
    }

    const { url } = req.body;
    if (!url || typeof url !== "string" || !url.trim()) {
      return errorData(res, 400, false, "Please provide a valid website URL to audit.");
    }

    const targetUrl = url.trim();

    // Execute crawler & deterministic audit checks
    let auditResult;
    try {
      auditResult = await executeWebsiteAudit(targetUrl, 5);
    } catch (auditErr) {
      console.warn("[WebsiteAudit] Audit error for", targetUrl, auditErr.message);
      return errorData(
        res,
        400,
        false,
        auditErr.message || "Failed to audit the website. Please ensure it is publicly accessible."
      );
    }

    // Save to Database against logged-in user
    const newAudit = new WebsiteAudit({
      user: userId,
      url: auditResult.url,
      domain: auditResult.domain,
      status: "completed",
      overallScore: auditResult.overallScore,
      grade: auditResult.grade,
      categoryScores: auditResult.categoryScores,
      stats: auditResult.stats,
      crawledPages: auditResult.crawledPages,
      imagesFindings: auditResult.imagesFindings,
      linksFindings: auditResult.linksFindings,
      issues: auditResult.issues,
      passedChecks: auditResult.passedChecks,
      unavailableChecks: auditResult.unavailableChecks,
    });

    const savedAudit = await newAudit.save();

    return successData(
      res,
      201,
      true,
      "Website audit completed successfully.",
      savedAudit
    );
  } catch (err) {
    console.error("[WebsiteAudit Controller] runAudit error:", err);
    return errorData(res, 500, false, "Internal server error while processing audit.");
  }
};

// ─── GET USER'S AUDIT HISTORY (Logged-in user sees only own) ────────────────
export const getUserAudits = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return errorData(res, 401, false, "Unauthorized");
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [audits, total] = await Promise.all([
      WebsiteAudit.find({ user: userId })
        .select("url domain status overallScore grade categoryScores stats createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebsiteAudit.countDocuments({ user: userId }),
    ]);

    return successData(res, 200, true, "Audits fetched successfully.", {
      audits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("[WebsiteAudit Controller] getUserAudits error:", err);
    return errorData(res, 500, false, "Failed to load audit history.");
  }
};

// ─── GET SINGLE AUDIT REPORT (Owner or Admin) ───────────────────────────────
export const getAuditById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const audit = await WebsiteAudit.findById(id).populate("user", "name email");
    if (!audit) {
      return errorData(res, 404, false, "Audit report not found.");
    }

    const isOwner = audit.user?._id?.toString() === userId?.toString() || audit.user?.toString() === userId?.toString();
    const isAdmin = isUserAdmin(req);

    if (!isOwner && !isAdmin) {
      return errorData(res, 403, false, "Access denied. You can only view your own audit reports.");
    }

    return successData(res, 200, true, "Audit report fetched successfully.", audit);
  } catch (err) {
    console.error("[WebsiteAudit Controller] getAuditById error:", err);
    return errorData(res, 500, false, "Failed to load audit report.");
  }
};

// ─── DELETE AUDIT (Owner or Admin) ──────────────────────────────────────────
export const deleteAudit = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const audit = await WebsiteAudit.findById(id);
    if (!audit) {
      return errorData(res, 404, false, "Audit report not found.");
    }

    const isOwner = audit.user?.toString() === userId?.toString();
    const isAdmin = isUserAdmin(req);

    if (!isOwner && !isAdmin) {
      return errorData(res, 403, false, "Access denied. You cannot delete this audit.");
    }

    await WebsiteAudit.findByIdAndDelete(id);
    return successData(res, 200, true, "Audit report deleted successfully.");
  } catch (err) {
    console.error("[WebsiteAudit Controller] deleteAudit error:", err);
    return errorData(res, 500, false, "Failed to delete audit report.");
  }
};

// ─── ADMIN: GET ALL AUDITS (Admin only) ──────────────────────────────────────
export const getAdminAllAudits = async (req, res) => {
  try {
    if (!isUserAdmin(req)) {
      return errorData(res, 403, false, "Access denied. Admin privileges required.");
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();

    const query = {};
    if (search) {
      query.$or = [
        { domain: { $regex: search, $options: "i" } },
        { url: { $regex: search, $options: "i" } },
      ];
    }

    const [audits, total, totalStats] = await Promise.all([
      WebsiteAudit.find(query)
        .populate("user", "name email phone")
        .select("user url domain status overallScore grade categoryScores stats issues createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebsiteAudit.countDocuments(query),
      WebsiteAudit.aggregate([
        {
          $group: {
            _id: null,
            totalAudits: { $sum: 1 },
            avgScore: { $avg: "$overallScore" },
          },
        },
      ]),
    ]);

    const stats = {
      totalAudits: totalStats[0]?.totalAudits || 0,
      avgScore: Math.round(totalStats[0]?.avgScore || 0),
    };

    return successData(res, 200, true, "Admin audits fetched successfully.", {
      audits,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("[WebsiteAudit Controller] getAdminAllAudits error:", err);
    return errorData(res, 500, false, "Failed to load admin audits.");
  }
};
