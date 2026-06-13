import Job from "../model/jobsListingSchema.js";
import User from "../model/userSchema.js";
import Category from "../model/categoriesSchema.js";
import City from "../model/CitiesSchema.js";
import slugify from "slugify";
import path from "path";
import { successData, errorData } from "../services/helper.js";
import googleIndexingService from "../services/googleIndexing.service.js";
import { APP_BASE_URL } from "../services/constant.js";
import {
  sendApprovedAndRejectedListingMail,
  sendListingSubmittedMail,
} from "../utils/sendMail.js";
import { sendPushNotification } from "../services/notification.service.js";

export const saveJobStep = async (req, res) => {
  try {
    const { job_id, slug } = req?.body;
    const step = Number(req?.params?.step);
    const user = req?.user;
    const method = req?.method; // POST / PUT

    let job = null;

    /* ── Helper: safely parse JSON string or return as-is ── */
    const safeParse = (val, fallback = []) => {
      if (!val) return fallback;
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return fallback;
        }
      }
      return val;
    };

    /* =========================
       FIND JOB IF job_id EXISTS
    ========================== */
    if (job_id || slug) {
      if (job_id) {
        job = await Job.findOne({
          _id: job_id,
          isDeleted: false,
        });
      } else if (slug) {
        job = await Job.findOne({
          slug: slug,
          isDeleted: false,
        });
      }

      if (!job) return errorData(res, 404, false, "Job not found");

      if (job.createdBy?.toString() !== user?.id && !user?.roles?.includes(1)) {
        return errorData(res, 403, false, "Unauthorized");
      }
    }

    /* =========================
       METHOD VALIDATION
    ========================== */

    if (method === "POST" && step !== 1) {
      return errorData(
        res,
        400,
        false,
        "POST allowed only for Step 1 (create job)",
      );
    }

    if (method === "PUT" && !(job_id || slug)) {
      return errorData(res, 400, false, "job_id or slug required for update");
    }

    /* =========================
       STEP 1 – CREATE OR UPDATE
    ========================== */
    if (step === 1) {
      const {
        category_id,
        sub_category_id,
        title,
        description,
        requirements = [],
        responsibilities = [],
        benefits = [],
        skills = [],
        sector,
        jobType,
        workMode,
        experienceLevel,
        total_positions,
        salary,
        location,
        education,
        noOfExperience,
        gender,
        ageRange,
        nationality = [],
        language = [],
        localities = [],
      } = req.body;

      /* ── Step 1 Validation ── */
      const validationErrors = {};
      if (!title || !title.toString().trim())
        validationErrors.title = "Job title is required";
      if (!category_id) validationErrors.category = "Job category is required";
      if (!sector) validationErrors.sector = "Sector is required";
      if (!jobType) validationErrors.jobType = "Job type is required";
      if (!experienceLevel)
        validationErrors.experienceLevel = "Experience level is required";

      if (Object.keys(validationErrors).length > 0) {
        return errorData(res, 400, false, "Validation failed", {
          errors: validationErrors,
        });
      }

      // Parse JSON-string arrays coming from FormData
      const parsedRequirements = safeParse(requirements);
      const parsedResponsibilities = safeParse(responsibilities);
      const parsedBenefits = safeParse(benefits);
      const parsedSkills = safeParse(skills);
      const parsedNationality = safeParse(nationality);
      const parsedLanguage = safeParse(language);
      const parsedLocalities = safeParse(localities);
      const parsedSalary = safeParse(salary, undefined);
      const parsedAgeRange = safeParse(ageRange, undefined);

      /* -------- CREATE (POST) -------- */
      if (method === "POST") {
        const baseSlug = slugify(title, { lower: true, strict: true });

        job = await Job.create({
          category: category_id,
          subCategory: sub_category_id || null,
          title,
          description,
          requirements: Array.isArray(parsedRequirements)
            ? parsedRequirements
            : [parsedRequirements].filter(Boolean),
          responsibilities: Array.isArray(parsedResponsibilities)
            ? parsedResponsibilities
            : [parsedResponsibilities].filter(Boolean),
          benefits: Array.isArray(parsedBenefits)
            ? parsedBenefits
            : [parsedBenefits].filter(Boolean),
          skills: Array.isArray(parsedSkills)
            ? parsedSkills
            : [parsedSkills].filter(Boolean),
          sector,
          jobType,
          workMode,
          experienceLevel,
          totalPositions: total_positions || 1,
          salary: parsedSalary,
          location,
          education,
          noOfExperience,
          gender,
          ageRange: parsedAgeRange,
          nationality: Array.isArray(parsedNationality)
            ? parsedNationality
            : [parsedNationality].filter(Boolean),
          language: Array.isArray(parsedLanguage)
            ? parsedLanguage
            : [parsedLanguage].filter(Boolean),
          localities: Array.isArray(parsedLocalities)
            ? parsedLocalities
            : [parsedLocalities].filter(Boolean),
          slug: baseSlug,
          createdBy: user?.id,
          status: "pending",
          stepCompleted: 1,
          isPublished: false,
        });

        // Update User statistics
        if (user?.id) {
          await User.findByIdAndUpdate(user.id, {
            $inc: {
              statistics_totalListings: 1,
              statistics_JobsListings: 1,
              statistics_activeListings: 1,
            },
          });
        }

        return successData(res, 200, true, "Job created successfully", {
          id: job._id,
          slug: job.slug,
        });
      }

      /* -------- UPDATE (PUT) -------- */
      if (method === "PUT") {
        if (title) {
          job.title = title;
          job.slug = slugify(title, { lower: true, strict: true });
        }

        if (description) job.description = description;
        if (category_id) job.category = category_id;
        if (sub_category_id) job.subCategory = sub_category_id;

        if (requirements)
          job.requirements = Array.isArray(parsedRequirements)
            ? parsedRequirements
            : [parsedRequirements];

        if (responsibilities)
          job.responsibilities = Array.isArray(parsedResponsibilities)
            ? parsedResponsibilities
            : [parsedResponsibilities];

        if (benefits)
          job.benefits = Array.isArray(parsedBenefits)
            ? parsedBenefits
            : [parsedBenefits];

        if (skills)
          job.skills = Array.isArray(parsedSkills)
            ? parsedSkills
            : [parsedSkills];

        if (sector) job.sector = sector;
        if (jobType) job.jobType = jobType;
        if (workMode) job.workMode = workMode;
        if (experienceLevel) job.experienceLevel = experienceLevel;
        if (total_positions) job.totalPositions = total_positions;
        if (salary) job.salary = parsedSalary;
        if (location) job.location = location;
        if (education) job.education = education;
        if (noOfExperience) job.noOfExperience = noOfExperience;
        if (gender) job.gender = gender;
        if (ageRange) job.ageRange = parsedAgeRange;
        if (nationality)
          job.nationality = Array.isArray(parsedNationality)
            ? parsedNationality
            : [parsedNationality];
        if (language)
          job.language = Array.isArray(parsedLanguage)
            ? parsedLanguage
            : [parsedLanguage];
        if (localities)
          job.localities = Array.isArray(parsedLocalities)
            ? parsedLocalities
            : [parsedLocalities];

        // If editing, status goes back to pending (never "unapproved")
        job.status = "pending";
      }
      job.stepCompleted = Math.max(job.stepCompleted || 1, 1);
    }

    /* =========================
       STEP 2 – CONTACT / MEDIA
    ========================== */
    if (step === 2) {
      if (method !== "PUT") {
        return errorData(res, 400, false, "Step 2 requires PUT method");
      }

      const {
        contact,
        company,
        seo_title,
        seo_description,
        seo_keywords,
        application_deadline,
      } = req.body;

      // Parse JSON strings (FormData sends strings)
      const parsedContact = safeParse(contact, null);
      const parsedCompany = safeParse(company, null);

      /* ── Step 2 Validation ── */
      const validationErrors = {};
      if (!parsedCompany?.name?.trim())
        validationErrors.company_name = "Company name is required";
      if (!parsedContact?.email?.trim()) {
        validationErrors.email = "Email is required";
      } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsedContact.email.trim())
      ) {
        validationErrors.email = "Invalid email format";
      }
      if (!parsedContact?.phone) {
        validationErrors.phone = "Phone number is required";
      }

      if (Object.keys(validationErrors).length > 0) {
        return errorData(res, 400, false, "Validation failed", {
          errors: validationErrors,
        });
      }

      if (parsedContact) job.contact = parsedContact;

      if (parsedCompany) {
        const companyLocality = parsedCompany.locality;

        // ✅ Resolve logo BEFORE building company object
        let resolvedLogo = job?.company?.logo; // fallback to existing
        if (req.files?.logo?.[0]) {
          resolvedLogo = req.files.logo[0].path.replace(/\\/g, "/");
        } else if (req.body.previous_company_logo) {
          resolvedLogo = req.body.previous_company_logo;
        }

        job.company = {
          name: parsedCompany.name || job.company?.name,
          website: parsedCompany.website || job.company?.website,
          size: parsedCompany.size || job.company?.size,
          description:
            parsedCompany.description !== undefined
              ? parsedCompany.description
              : job.company?.description,
          logo: resolvedLogo, // ✅ always correct now
          address:
            parsedCompany.address !== undefined
              ? parsedCompany.address
              : job.company?.address,
          locality:
            parsedCompany.locality !== undefined
              ? parsedCompany.locality
              : job.company?.locality,
          city:
            parsedCompany.city !== undefined
              ? parsedCompany.city
              : job.company?.city,
        };

        if (companyLocality) {
          const localitiesArr = Array.isArray(companyLocality)
            ? companyLocality
            : [companyLocality];
          job.localities = localitiesArr.filter(Boolean);
        }
      }

      job.seo = {
        title: seo_title || job.seo?.title,
        description: seo_description || job.seo?.description,
        keywords: seo_keywords
          ? Array.isArray(seo_keywords)
            ? seo_keywords
            : [seo_keywords]
          : job.seo?.keywords,
      };

      if (application_deadline) job.applicationDeadline = application_deadline;

      // Status: always "pending" — never "unapproved"
      job.status = "pending";
      job.availableStatus = "open";
      job.isActive = true;
      // job.isPublished = true;
      job.stepCompleted = Math.max(job.stepCompleted || 1, 2);

      googleIndexingService.notify(
        `${APP_BASE_URL}/job/${job.slug}`,
        "URL_UPDATED",
      );

      // ── Send submitted mail ──
      try {
        const categoryDoc = await Category.findById(job.category);
        const categoryName = categoryDoc?.name || "";

        await sendListingSubmittedMail(
          job.contact?.email || user?.email,
          job.contact?.name || user?.name || "User",
          job.title,
          categoryName,
          new Date().toLocaleDateString("en-AE", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          `${APP_BASE_URL}/dashboard`,
        );
      } catch (mailError) {
        console.warn("❌ Job submission mail failed:", mailError.message);
      }
    }

    /* =========================
       STEP 3 – PLAN & PUBLISH
    ========================== */
    if (step === 3) {
      if (job.stepCompleted < 2) {
        return errorData(
          res,
          400,
          false,
          "Please complete all previous steps before publishing",
        );
      }

      job.plan = req.body.plan_id || null;
      job.isPublished = true;
      job.status = "pending"; // Admin still needs to approve
      job.stepCompleted = Math.max(job.stepCompleted || 1, 3);

      googleIndexingService.notify(
        `${APP_BASE_URL}/job/${job.slug}`,
        "URL_UPDATED",
      );
    }

    await job.save();

    // Return showThankYou flag for step 2 so frontend can show the popup
    const responseData = {
      id: job._id,
      slug: job.slug,
    };
    if (step === 2) {
      responseData.showThankYou = true;
    }

    return successData(res, 200, true, `Step ${step} saved`, responseData);
  } catch (error) {
    console.warn("Job step error:", error);

    // ── Mongoose validation error ──
    if (error.name === "ValidationError") {
      const fieldErrors = {};
      for (const key in error.errors) {
        fieldErrors[key] = error.errors[key].message;
      }
      return errorData(res, 400, false, "Validation failed", {
        errors: fieldErrors,
      });
    }

    // ── Duplicate key error (slug collision etc.) ──
    if (error.code === 11000) {
      return errorData(
        res,
        409,
        false,
        "A job with this title already exists. Please use a different title.",
      );
    }

    return errorData(res, 500, false, "Internal server error");
  }
};

/* =========================
   GET ALL JOBS
========================== */
export const getAllJobsWithPaginationAndFilters = async (req, res) => {
  try {
    // =========================
    // Pagination
    // =========================
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ DEBUG: Log what's actually coming in
    console.log("Query Params Received:", req.query);

    // =========================
    // Base Filter
    // =========================
    const filter = {
      isDeleted: false,
    };

    // =========================
    // Role Check
    // =========================
    const isAdmin = req.user?.roles?.includes(1);

    // =========================
    // Query Filters
    // =========================
    // Query Params Aliases
    const categoryId = req.query.category_id || req.query.category;
    const subCategoryId =
      req.query.sub_category_id ||
      req.query.subcategory ||
      req.query.subCategory;

    if (categoryId) filter.category = categoryId;
    if (subCategoryId) filter.subCategory = subCategoryId;

    // ✅ Status filter with validation
    const VALID_STATUSES = ["pending", "approved", "rejected"];
    if (req.query.status) {
      const statusValue = req.query.status.trim().toLowerCase();
      if (VALID_STATUSES.includes(statusValue)) {
        filter.status = statusValue;
      } else {
        return errorData(
          res,
          400,
          false,
          `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        );
      }
    } else if (!isAdmin) {
      // Default for public: only approved jobs
      filter.status = "approved";
      filter.isActive = true;
      filter.isDeleted = false;
    }

    if (req.query.isVerified !== undefined)
      filter.isVerified = req.query.isVerified === "true";

    if (req.query.isActive !== undefined)
      filter.isActive = req.query.isActive === "true";

    if (req.query.isPublished !== undefined)
      filter.isPublished = req.query.isPublished === "true";

    if (req.query.isFeatured !== undefined)
      filter.isFeatured = req.query.isFeatured === "true";

    if (req.query.isUrgent !== undefined)
      filter.isUrgent = req.query.isUrgent === "true";

    if (req.query.availableStatus !== undefined)
      filter.availableStatus = req.query.availableStatus;

    if (req.query.userId !== undefined) filter.createdBy = req.query.userId;

    if (req.query.sector) filter.sector = req.query.sector;
    if (req.query.jobType) filter.jobType = req.query.jobType;
    if (req.query.workMode) filter.workMode = req.query.workMode;
    if (req.query.experienceLevel)
      filter.experienceLevel = req.query.experienceLevel;

    if (req.query.education) filter.education = req.query.education;
    if (req.query.gender) filter.gender = req.query.gender;

    // Nationality & Language (Array overlaps)
    if (req.query.nationality) {
      const nationalitiArray = Array.isArray(req.query.nationality)
        ? req.query.nationality
        : [req.query.nationality];
      filter.nationality = { $in: nationalitiArray };
    }

    if (req.query.language) {
      const langArray = Array.isArray(req.query.language)
        ? req.query.language
        : [req.query.language];
      filter.language = { $in: langArray };
    }

    // Location
    if (req.query.city) {
      // Handle both ID string or slug
      if (mongoose.Types.ObjectId.isValid(req.query.city)) {
        filter["location.city._id"] = req.query.city;
      } else {
        filter["location.city.slug"] = req.query.city;
      }
    }

    if (req.query.country) filter["location.country"] = req.query.country;

    if (req.query.locality) {
      const localityArray = Array.isArray(req.query.locality)
        ? req.query.locality
        : [req.query.locality];
      filter.$or = filter.$or || [];
      filter.$or.push(
        { "company.locality": { $in: localityArray } },
        { localities: { $in: localityArray } },
      );
    }

    // Remote filter
    if (req.query.isRemote === "true" || req.query.workMode === "remote") {
      filter["location.isRemote"] = true;
    }

    // =========================
    // Salary Filter (NEW 🔥)
    // =========================
    if (req.query.salaryMin || req.query.salaryMax) {
      filter["salary.from"] = {};
      if (req.query.salaryMin) {
        filter["salary.from"].$gte = Number(req.query.salaryMin);
      }
      if (req.query.salaryMax) {
        filter["salary.from"].$lte = Number(req.query.salaryMax);
      }
    }

    // =========================
    // Search (Improved 🔥)
    // =========================
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");

      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { "company.name": searchRegex },
        { skills: { $in: [searchRegex] } },
      ];
    }

    // ✅ DEBUG: Log the final filter being passed to MongoDB
    console.log("Final MongoDB Filter:", JSON.stringify(filter, null, 2));

    // =========================
    // Query Execution
    // =========================
    const [jobs, total, totalAll, totalPending, totalApproved, totalRejected] =
      await Promise.all([
        Job.find(filter)
          .populate("category", "name")
          .populate("subCategory", "name")
          .populate("createdBy", "name email phone isOnline")
          .populate("approvedBy", "name email phone")
          .populate("rejectedBy", "name email phone")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        Job.countDocuments(filter),
        Job.countDocuments({ isDeleted: false }),
        Job.countDocuments({ isDeleted: false, status: "pending" }),
        Job.countDocuments({ isDeleted: false, status: "approved" }),
        Job.countDocuments({ isDeleted: false, status: "rejected" }),
      ]);

    // =========================
    // Success Response
    // =========================
    return successData(res, 200, true, "Jobs fetched successfully", {
      jobs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      totalAll,
      statusCounts: {
        pending: totalPending,
        approved: totalApproved,
        rejected: totalRejected,
      },
    });
  } catch (error) {
    console.error("Job fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* =========================
   GET ALL JOBS BY USER
========================== */
export const getAllJobsByUser = async (req, res) => {
  try {
    const user = req?.user;
    if (!user || !user.id) {
      return errorData(res, 401, false, "Unauthorized");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      createdBy: user.id,
      isDeleted: false,
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [
      jobs,
      total,
      pendingCount,
      approvedCount,
      rejectedCount,
      publishedCount,
      verifiedCount,
    ] = await Promise.all([
      Job.find(filter)
        .populate("category", "name")
        .populate("subCategory", "name")
        .populate("plan", "name")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Job.countDocuments(filter),
      Job.countDocuments({ ...filter, status: "pending" }),
      Job.countDocuments({ ...filter, status: "approved" }),
      Job.countDocuments({ ...filter, status: "rejected" }),
      Job.countDocuments({ ...filter, isPublished: true }),
      Job.countDocuments({ ...filter, isVerified: true }),
    ]);

    if (!jobs.length && page === 1)
      return errorData(res, 404, false, "No jobs found for this user");

    return successData(res, 200, true, "User jobs fetched successfully", {
      total,
      statistics: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        published: publishedCount,
        verified: verifiedCount,
      },
      jobs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.warn("User job fetch error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* =========================
   GET SINGLE JOB BY ID
========================== */
export const getJobById = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return errorData(res, 400, false, "Job Slug is required");

    const job = await Job.findOne({
      slug: slug,
      isDeleted: false,
    })
      .populate("category", "name")
      .populate("subCategory", "name")
      .lean();

    if (!job)
      return errorData(res, 404, false, "Job not found", {
        slug: slug,
      });

    return successData(res, 200, true, "Job fetched successfully", job);
  } catch (error) {
    console.warn("Job fetch err:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* =========================
   SOFT DELETE JOB
========================== */
/* =========================
   GET LAST JOB COMPANY DETAILS
========================== */
export const getLastJobCompanyDetails = async (req, res) => {
  try {
    const user = req?.user;
    if (!user || !user.id) {
      return errorData(res, 401, false, "Unauthorized");
    }

    const jobs = await Job.find({
      createdBy: user.id,
      isDeleted: false,
      // Must have at least a company name to be useful
      "company.name": { $exists: true, $ne: null, $ne: "" },
    })
      .sort({ createdAt: -1 })
      .select("company contact location")
      .lean();

    if (!jobs || jobs.length === 0) {
      return successData(
        res,
        200,
        true,
        "No previous company details found",
        [],
      );
    }

    // Filter unique companies by name
    const uniqueCompanies = [];
    const seenNames = new Set();

    for (const job of jobs) {
      const cmpName = job.company?.name?.trim()?.toLowerCase();
      if (cmpName && !seenNames.has(cmpName)) {
        seenNames.add(cmpName);
        uniqueCompanies.push({
          company: job.company,
          contact: job.contact,
          location: job.location,
          jobId: job._id,
        });
      }
    }

    return successData(
      res,
      200,
      true,
      "Previous companies fetched",
      uniqueCompanies,
    );
  } catch (error) {
    console.warn("getLastJobCompanyDetails error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const deleteJob = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return errorData(res, 400, false, "Job Slug is required");

    const job = await Job.findOneAndUpdate(
      { slug: slug },
      { isDeleted: true, availableStatus: "closed", isActive: false },
      { new: true },
    );

    if (!job) return errorData(res, 404, false, "Job not found");

    googleIndexingService.notify(
      `${APP_BASE_URL}/job/${job.slug}`,
      "URL_DELETED",
    );

    // Update User statistics
    if (job.createdBy) {
      await User.findByIdAndUpdate(job.createdBy, {
        $inc: {
          statistics_activeListings: -1,
          statistics_JobsListings: -1,
          statistics_totalListings: -1,
        },
      });
    }

    return successData(res, 200, true, "Job deleted successfully", {
      slug: job.slug,
    });
  } catch (error) {
    console.warn("Job delete error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* =========================
   UPDATE JOB STATUS (ADMIN)
========================== */
export const updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status, availableStatus, rejectionReason } = req.body;
    const adminId = req.user._id;

    const validAvailableStatuses = ["open", "closed", "expired", "pending"];

    // If frontend sends everything via `status` property, elegantly route it
    if (status && !availableStatus) {
      if (["open", "closed", "expired"].includes(status)) {
        availableStatus = status;
        status = undefined; // Not a moderation status
      }
    }

    // Only approved/rejected are treated explicitly.
    // Everything else becomes pending.
    if (status) {
      status =
        status === "approved"
          ? "approved"
          : status === "rejected"
            ? "rejected"
            : "pending";
    }
    if (availableStatus && !validAvailableStatuses.includes(availableStatus)) {
      return errorData(res, 400, false, "Invalid available status value");
    }

    if (!status && !availableStatus) {
      return errorData(res, 400, false, "No valid status provided");
    }

    if (status === "rejected" && !rejectionReason?.trim()) {
      return errorData(res, 400, false, "Rejection reason is required");
    }

    const job = await Job.findById(id);
    if (!job) return errorData(res, 404, false, "Job not found");

    if (status) {
      job.status = status;
      if (status === "approved") {
        job.approvedBy = adminId;
        job.rejectedBy = null;
        job.rejectionReason = null;
        job.isPublished = true;
      } else if (status === "rejected") {
        job.rejectedBy = adminId;
        job.rejectionReason = rejectionReason;
        job.approvedBy = null;
        job.isPublished = false;
      } else if (status === "pending") {
        job.approvedBy = null;
        job.rejectedBy = null;
        job.rejectionReason = null;
        job.isPublished = false;
      }

      // ── Send Email & Notification ──
      // Note: Only send email for moderation approval/rejection.
      if (["approved", "rejected"].includes(status)) {
        try {
          const categoryDoc = await Category.findById(job.category);
          const categoryName = categoryDoc?.name || "";

          await sendApprovedAndRejectedListingMail(
            job.contact?.email || req.user.email,
            job.contact?.name || "User",
            status,
            rejectionReason || `Your job listing has been ${status}.`,
            {
              businessName: job.title,
              category: categoryName,
              listingUrl: `${APP_BASE_URL}/job/${job.slug}`,
              dashboardUrl: `${APP_BASE_URL}/dashboard`,
            },
          );

          if (job.createdBy) {
            const pushTitle =
              status === "approved"
                ? "Job Listing Approved 🎉"
                : "Job Listing Rejected ❌";
            const pushBody =
              status === "approved"
                ? `Congratulations! Your job listing "${job.title}" has been successfully approved.`
                : `We're sorry, your job listing "${job.title}" was rejected. ${rejectionReason ? "Reason: " + rejectionReason.trim() : ""}`;

            await sendPushNotification(job.createdBy, pushTitle, pushBody, {
              type: "JOB_LISTING_STATUS",
              listingId: job._id.toString(),
              status: status,
            });
          }
        } catch (mailError) {
          console.warn(
            "❌ Admin status mail/notification failed:",
            mailError.message,
          );
        }
      }
    }

    if (availableStatus) {
      job.availableStatus = availableStatus;
    }

    await job.save();

    return successData(res, 200, true, `Job status updated`, { id: job._id });
  } catch (error) {
    console.warn("Update job status error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* =========================
   GET JOBS BY CATEGORY & CITY (Public SEO)
========================== */
export const getJobsByCategoryAndCity = async (req, res) => {
  try {
    const { category_slug, city_slug } = req.params;
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    // 🔹 Base filter
    const filter = {
      isDeleted: false,
      status: "approved",
      availableStatus: "open",
    };

    // =========================
    // CATEGORY FILTER
    // =========================
    if (category_slug) {
      const category = await Category.findOne({
        slug: category_slug,
        isDeleted: false,
      }).lean();

      if (!category) {
        return errorData(res, 404, false, "Category not found");
      }

      filter.category = category._id;
    }

    // =========================
    // CITY FILTER
    // =========================
    if (city_slug) {
      const city = await City.findOne({
        slug: city_slug,
        deletedAt: null,
      }).lean();

      if (!city) {
        return errorData(res, 404, false, "City not found");
      }

      // ✅ IMPORTANT: use slug (NOT _id)
      filter["location.city.slug"] = city.slug;
    }

    // =========================
    // DEBUG LOG (REMOVE IN PROD)
    // =========================
    // console.log("FINAL FILTER =>", JSON.stringify(filter, null, 2));

    const skip = (page - 1) * limit;

    // =========================
    // FETCH DATA
    // =========================
    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Job.countDocuments(filter),
    ]);

    // =========================
    // RESPONSE
    // =========================
    return successData(res, 200, true, "Jobs fetched successfully", {
      jobs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Get jobs by category/city error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── PUBLISH LISTING BY USER/ADMIN ───────────────────────────────────────────
export const publishListing = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = identifier.match(/^[0-9a-fA-F]{24}$/);

    const listing = await Job.findOne({
      $or: [
        { _id: isObjectId ? identifier : undefined },
        { slug: identifier },
      ].filter(Boolean),
      isDeleted: false,
    });

    if (!listing) return errorData(res, 404, false, "Listing not found");

    // Ownership check
    const userRole = req.user?.roles?.includes(1);
    if (
      listing.createdBy &&
      req.user?.id &&
      listing.createdBy.toString() !== req.user.id.toString() &&
      !userRole
    ) {
      return errorData(
        res,
        403,
        false,
        "Forbidden: you do not own this listing",
      );
    }

    listing.isPublished = true;
    await listing.save();

    // Notify Google indexing (Keeping commented as per user's manual edits)
    // try {
    //   googleIndexingService.notify(`${APP_BASE_URL}/job/${listing.slug}`, "URL_UPDATED");
    // } catch (err) {
    //   console.warn("Google Indexing notify failed:", err);
    // }

    return successData(res, 200, true, "Listing published successfully", {
      id: listing._id,
      isPublished: listing.isPublished,
    });
  } catch (error) {
    console.warn("Listing publish error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

// ─── UNPUBLISH LISTING BY USER/ADMIN ─────────────────────────────────────────
export const unpublishListing = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = identifier.match(/^[0-9a-fA-F]{24}$/);

    const listing = await Job.findOne({
      $or: [
        { _id: isObjectId ? identifier : undefined },
        { slug: identifier },
      ].filter(Boolean),
      isDeleted: false,
    });

    if (!listing) return errorData(res, 404, false, "Listing not found");

    // Ownership check
    const userRole = req.user?.roles?.includes(1);
    if (
      listing.createdBy &&
      req.user?.id &&
      listing.createdBy.toString() !== req.user.id.toString() &&
      !userRole
    ) {
      return errorData(
        res,
        403,
        false,
        "Forbidden: you do not own this listing",
      );
    }

    listing.isPublished = false;
    await listing.save();

    // Notify Google indexing (Keeping commented as per user's manual edits)
    // try {
    //   googleIndexingService.notify(`${APP_BASE_URL}/job/${listing.slug}`, "URL_DELETED");
    // } catch (err) {
    //   console.warn("Google Indexing notify failed:", err);
    // }

    return successData(res, 200, true, "Listing unpublished successfully", {
      id: listing._id,
      isPublished: listing.isPublished,
    });
  } catch (error) {
    console.warn("Listing unpublish error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
