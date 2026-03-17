// controllers/jobApplicationController.js
import JobApplication from "../model/jobApplicationSchema.js";
import Job from "../model/jobsListingSchema.js";
import { successData, errorData } from "../services/helper.js";

/* ═══════════════════════════════════════════════════════════
   APPLY FOR A JOB
   POST /api/applications/:slug/apply
   • Auth optional (logged-in user OR guest via email)
   • Multipart/form-data  →  resume file (optional)
═══════════════════════════════════════════════════════════ */
export const applyForJob = async (req, res) => {
  try {
    const { slug } = req.params;
    const user = req.user || null; // set by auth middleware (optional)

    // ── 1. Validate job exists and is accepting applications ──
    const job = await Job.findOne({
      slug,
      isDeleted: false,
      isActive: true,
      status: "active",
    }).lean();

    if (!job) return errorData(res, 404, false, "Job not found or no longer active");

    if (
      job.applicationDeadline &&
      new Date() > new Date(job.applicationDeadline)
    ) {
      return errorData(res, 400, false, "Application deadline has passed");
    }

    // ── 2. Extract body fields ────────────────────────────────
    const {
      fullName,
      email,
      phone,
      whatsapp,
      coverLetter,
      expectedSalary,
      availableFrom,
      currentJobTitle,
      currentCompany,
      totalExperience,
      portfolioUrl,
      linkedinUrl,
      githubUrl,
      source,
    } = req.body;

    // ── 3. Basic validation ───────────────────────────────────
    if (!fullName || !email) {
      return errorData(res, 400, false, "Full name and email are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorData(res, 400, false, "Invalid email address");
    }

    // ── 4. Duplicate check ────────────────────────────────────
    const alreadyApplied = await JobApplication.findOne({
      job: job._id,
      email: email.toLowerCase().trim(),
      isDeleted: false,
    });

    if (alreadyApplied) {
      return errorData(res, 409, false, "You have already applied for this job");
    }

    // ── 5. Resume upload handling ─────────────────────────────
    let resume = { url: null, originalName: null };
    if (req.file) {
      resume = {
        url: req.file.path,               // multer sets path (local or cloud URL)
        originalName: req.file.originalname,
      };
    }

    // ── 6. Create application ─────────────────────────────────
    const application = await JobApplication.create({
      job:            job._id,
      applicant:      user?.id || null,
      fullName:       fullName.trim(),
      email:          email.toLowerCase().trim(),
      phone:          phone    || null,
      whatsapp:       whatsapp || null,
      coverLetter:    coverLetter    || null,
      expectedSalary: expectedSalary || null,
      availableFrom:  availableFrom  || null,
      currentJobTitle:currentJobTitle|| null,
      currentCompany: currentCompany || null,
      totalExperience:totalExperience|| null,
      portfolioUrl:   portfolioUrl   || null,
      linkedinUrl:    linkedinUrl    || null,
      githubUrl:      githubUrl      || null,
      resume,
      source: source || "website",
      status: "pending",
    });

    // ── 7. Increment job application counter ──────────────────
    await Job.findByIdAndUpdate(job._id, { $inc: { applications: 1 } });

    return successData(res, 201, true, "Application submitted successfully", {
      applicationId: application._id,
      status: application.status,
    });
  } catch (error) {
    if (error.code === 11000) {
      return errorData(res, 409, false, "You have already applied for this job");
    }
    console.error("Apply job error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};


/* ═══════════════════════════════════════════════════════════
   GET ALL APPLICATIONS FOR A JOB  (Admin / Job Owner)
   GET /api/applications/:slug
   Query: page, limit, status, search (applicant name/email)
═══════════════════════════════════════════════════════════ */
export const getApplicationsByJob = async (req, res) => {
  try {
    const { slug } = req.params;
    const user = req.user;

    // Find the job
    const job = await Job.findOne({ slug, isDeleted: false }).lean();
    if (!job) return errorData(res, 404, false, "Job not found");

    // Only owner or admin can view applications
    if (
      job.createdBy?.toString() !== user?.id &&
      user?.role !== "admin"
    ) {
      return errorData(res, 403, false, "Unauthorized");
    }

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const filter = { job: job._id, isDeleted: false };

    if (req.query.status) filter.status = req.query.status;

    if (req.query.search) {
      const regex = { $regex: req.query.search, $options: "i" };
      filter.$or = [{ fullName: regex }, { email: regex }];
    }

    const [applications, total] = await Promise.all([
      JobApplication.find(filter)
        .select("-adminNote -__v")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      JobApplication.countDocuments(filter),
    ]);

    return successData(res, 200, true, "Applications fetched successfully", {
      applications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get applications error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};


/* ═══════════════════════════════════════════════════════════
   GET SINGLE APPLICATION  (Admin / Job Owner)
   GET /api/applications/detail/:applicationId
═══════════════════════════════════════════════════════════ */
export const getApplicationById = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const user = req.user;

    const application = await JobApplication.findOne({
      _id: applicationId,
      isDeleted: false,
    })
      .populate("job", "title slug createdBy")
      .lean();

    if (!application) return errorData(res, 404, false, "Application not found");

    // Authorization
    const isOwner  = application.job?.createdBy?.toString() === user?.id;
    const isAdmin  = user?.role === "admin";
    const isSelf   = application.applicant?.toString() === user?.id;

    if (!isOwner && !isAdmin && !isSelf) {
      return errorData(res, 403, false, "Unauthorized");
    }

    // Mark as read when owner/admin views
    if ((isOwner || isAdmin) && !application.isRead) {
      await JobApplication.findByIdAndUpdate(applicationId, { isRead: true });
    }

    return successData(res, 200, true, "Application fetched", application);
  } catch (error) {
    console.error("Get application error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};


/* ═══════════════════════════════════════════════════════════
   UPDATE APPLICATION STATUS  (Admin / Job Owner)
   PATCH /api/applications/:applicationId/status
   Body: { status, adminNote? }
═══════════════════════════════════════════════════════════ */
export const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, adminNote } = req.body;
    const user = req.user;

    const VALID_STATUSES = [
      "pending", "reviewing", "shortlisted",
      "interview", "offered", "hired", "rejected", "withdrawn",
    ];

    if (!status || !VALID_STATUSES.includes(status)) {
      return errorData(
        res, 400, false,
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
      );
    }

    const application = await JobApplication.findOne({
      _id: applicationId,
      isDeleted: false,
    }).populate("job", "createdBy");

    if (!application) return errorData(res, 404, false, "Application not found");

    const isOwner = application.job?.createdBy?.toString() === user?.id;
    const isAdmin = user?.role === "admin";

    if (!isOwner && !isAdmin) {
      return errorData(res, 403, false, "Unauthorized");
    }

    application.status = status;
    if (adminNote !== undefined) application.adminNote = adminNote;

    await application.save();

    return successData(res, 200, true, "Application status updated", {
      applicationId: application._id,
      status: application.status,
    });
  } catch (error) {
    console.error("Update status error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};


/* ═══════════════════════════════════════════════════════════
   WITHDRAW APPLICATION  (Applicant only)
   PATCH /api/applications/:applicationId/withdraw
═══════════════════════════════════════════════════════════ */
export const withdrawApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const user = req.user;

    const application = await JobApplication.findOne({
      _id: applicationId,
      isDeleted: false,
    });

    if (!application) return errorData(res, 404, false, "Application not found");

    // Only the applicant can withdraw
    const isSelf  = application.applicant?.toString() === user?.id;
    const isEmail = application.email === user?.email;

    if (!isSelf && !isEmail) {
      return errorData(res, 403, false, "Unauthorized");
    }

    if (["hired", "rejected", "withdrawn"].includes(application.status)) {
      return errorData(
        res, 400, false,
        `Cannot withdraw application with status: ${application.status}`
      );
    }

    application.status = "withdrawn";
    await application.save();

    // Decrement job applications counter
    await Job.findByIdAndUpdate(application.job, { $inc: { applications: -1 } });

    return successData(res, 200, true, "Application withdrawn successfully");
  } catch (error) {
    console.error("Withdraw error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};


/* ═══════════════════════════════════════════════════════════
   GET MY APPLICATIONS  (Logged-in user)
   GET /api/applications/my
   Query: page, limit, status
═══════════════════════════════════════════════════════════ */
export const getMyApplications = async (req, res) => {
  try {
    const user = req.user;

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const filter = {
      $or: [
        { applicant: user.id },
        { email: user.email },
      ],
      isDeleted: false,
    };

    if (req.query.status) filter.status = req.query.status;

    const [applications, total] = await Promise.all([
      JobApplication.find(filter)
        .populate("job", "title slug company location jobType status")
        .select("-adminNote -__v")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      JobApplication.countDocuments(filter),
    ]);

    return successData(res, 200, true, "Your applications", {
      applications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("My applications error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};


/* ═══════════════════════════════════════════════════════════
   SOFT DELETE APPLICATION  (Admin only)
   DELETE /api/applications/:applicationId
═══════════════════════════════════════════════════════════ */
export const deleteApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const user = req.user;

    if (user?.role !== "admin") {
      return errorData(res, 403, false, "Admin access required");
    }

    const application = await JobApplication.findOneAndUpdate(
      { _id: applicationId, isDeleted: false },
      { isDeleted: true },
      { new: true },
    );

    if (!application) return errorData(res, 404, false, "Application not found");

    return successData(res, 200, true, "Application deleted");
  } catch (error) {
    console.error("Delete application error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};


/* ═══════════════════════════════════════════════════════════
   GET APPLICATION STATS FOR A JOB  (Admin / Job Owner)
   GET /api/applications/:slug/stats
═══════════════════════════════════════════════════════════ */
export const getApplicationStats = async (req, res) => {
  try {
    const { slug } = req.params;
    const user = req.user;

    const job = await Job.findOne({ slug, isDeleted: false }).lean();
    if (!job) return errorData(res, 404, false, "Job not found");

    const isOwner = job.createdBy?.toString() === user?.id;
    const isAdmin = user?.role === "admin";

    if (!isOwner && !isAdmin) {
      return errorData(res, 403, false, "Unauthorized");
    }

    const stats = await JobApplication.aggregate([
      { $match: { job: job._id, isDeleted: false } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Shape: { total, pending, reviewing, shortlisted, ... }
    const result = { total: 0 };
    stats.forEach(({ _id, count }) => {
      result[_id] = count;
      result.total += count;
    });

    const unread = await JobApplication.countDocuments({
      job: job._id,
      isRead: false,
      isDeleted: false,
    });

    result.unread = unread;

    return successData(res, 200, true, "Application stats", result);
  } catch (error) {
    console.error("Stats error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
