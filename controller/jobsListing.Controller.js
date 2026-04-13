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

/* =========================
   SAVE JOB (2-STEP WIZARD)
========================== */
// export const saveJobStep = async (req, res) => {
//   try {
//     const { job_id } = req.body;
//     const step = req.params.step;
//     const user = req.user;
//     console.log("USERR ::", user);

//     /* =========================
//        STEP 1 – JOB DETAILS & REQS
//     ========================== */
//     if (Number(step) === 1) {
//       const {
//         category_id,
//         sub_category_id,
//         title,
//         description,
//         requirements = [],
//         responsibilities = [],
//         benefits = [],
//         sector,
//         jobType,
//         workMode,
//         experienceLevel,
//         total_positions = 1,
//         salary,
//         location,
//         education,
//         experienceYears,
//         gender,
//         ageRange,
//       } = req.body;

//       const baseSlug = slugify(title, { lower: true, strict: true });
//       const slug = baseSlug

//       const job = await Job.create({
//         category: category_id,
//         subCategory: sub_category_id || null,
//         title,
//         description: description || null,
//         requirements: Array.isArray(requirements) ? requirements : [requirements].filter(Boolean),
//         responsibilities: Array.isArray(responsibilities) ? responsibilities : [responsibilities].filter(Boolean),
//         benefits: Array.isArray(benefits) ? benefits : [benefits].filter(Boolean),
//         sector,
//         jobType,
//         workMode: workMode || "on-site",
//         experienceLevel,
//         totalPositions: total_positions,
//         salary: salary || undefined,
//         location: location || undefined,
//         education: education || "any",
//         experienceYears: experienceYears || undefined,
//         gender: gender || "any",
//         ageRange: ageRange || undefined,
//         slug,
//         createdBy: req.user?.id || null, // Assuming you have req.user from auth middleware
//         status: "pending",
//       });

//       return successData(res, 200, true, "Job created successfully", {
//         id: job._id,
//         slug: job.slug,
//       });
//     }
// 0.
//     /* =========================
//        FIND JOB (for Step 2)
//     ========================== */
//     const job = await Job.findOne({
//       _id: job_id,
//       isDeleted: false,
//     });

//     if (!job) return errorData(res, 404, false, "Job not found");

//     /* =========================
//        STEP 2 – CONTACT, MEDIA & SEO
//     ========================== */
//     if (Number(step) === 2) {
//       const { contact, company, seo_title, seo_description, seo_keywords, application_deadline } = req.body;

//       job.contact = contact || job.contact;

//       // Merge company info, keep existing properties if not provided
//       job.company = {
//         name: company?.name || job.company?.name,
//         website: company?.website || job.company?.website,
//         size: company?.size || job.company?.size,
//         logo: job.company?.logo // Keep existing logo first
//       };

//       job.seo = {
//         title: seo_title || null,
//         description: seo_description || null,
//         keywords: Array.isArray(seo_keywords) ? seo_keywords : [seo_keywords].filter(Boolean),
//       };

//       job.applicationDeadline = application_deadline || null;

//       // Handle file uploads via Multer
//       // company logo — single file
//       if (req.files?.logo?.[0]) {
//         job.company.logo = req.files.logo[0].path;
//       }

//       // images — multiple files, append to existing
//       if (req.files?.images?.length > 0) {
//         const newImages = req.files.images.map((img) => img.path);
//         job.images = [...(job.images || []), ...newImages];
//       }

//       // Finalize the posting
//       job.status = "active";
//       job.isActive = true;
//     }

//     await job.save();

//     return successData(res, 200, true, `Step ${step} saved successfully`, {
//       id: job._id,
//     });
//   } catch (error) {
//     console.warn("Job step error:", error);
//     return errorData(res, 500, false, "Internal server error");
//   }
// };

export const saveJobStep = async (req, res) => {
  console.log("REQQ BODYY :", req?.body);

  try {
    const { job_id, slug } = req?.body;
    const step = Number(req?.params?.step);
    const user = req?.user;
    const method = req?.method; // POST / PUT

    let job = null;
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
      } = req.body;

      /* -------- CREATE (POST) -------- */
      if (method === "POST") {
        const baseSlug = slugify(title, { lower: true, strict: true });

        job = await Job.create({
          category: category_id,
          subCategory: sub_category_id || null,
          title,
          description,
          requirements: Array.isArray(requirements)
            ? requirements
            : [requirements].filter(Boolean),
          responsibilities: Array.isArray(responsibilities)
            ? responsibilities
            : [responsibilities].filter(Boolean),
          benefits: Array.isArray(benefits)
            ? benefits
            : [benefits].filter(Boolean),
          skills: Array.isArray(skills) ? skills : [skills].filter(Boolean),
          sector,
          jobType,
          workMode,
          experienceLevel,
          totalPositions: total_positions || 1,
          salary,
          location,
          education,
          noOfExperience,
          gender,
          ageRange,
          nationality: Array.isArray(nationality) ? nationality : [nationality].filter(Boolean),
          language: Array.isArray(language) ? language : [language].filter(Boolean),
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
          job.requirements = Array.isArray(requirements)
            ? requirements
            : [requirements];

        if (responsibilities)
          job.responsibilities = Array.isArray(responsibilities)
            ? responsibilities
            : [responsibilities];

        if (benefits)
          job.benefits = Array.isArray(benefits) ? benefits : [benefits];

        if (skills) job.skills = Array.isArray(skills) ? skills : [skills];

        if (sector) job.sector = sector;
        if (jobType) job.jobType = jobType;
        if (workMode) job.workMode = workMode;
        if (experienceLevel) job.experienceLevel = experienceLevel;
        if (total_positions) job.totalPositions = total_positions;
        if (salary) job.salary = salary;
        if (location) job.location = location;
        if (education) job.education = education;
        if (noOfExperience) job.noOfExperience = noOfExperience;
        if (gender) job.gender = gender;
        if (ageRange) job.ageRange = ageRange;
        if (nationality) job.nationality = Array.isArray(nationality) ? nationality : [nationality];
        if (language) job.language = Array.isArray(language) ? language : [language];
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

      if (contact) job.contact = contact;

      if (company) {
        job.company = {
          name: company.name || job.company?.name,
          website: company.website || job.company?.website,
          size: company.size || job.company?.size,
          description: company.description !== undefined ? company.description : job.company?.description,
          logo: company?.logo !== undefined ? company?.logo : job?.company?.logo,
          address: company.address !== undefined ? company.address : job.company?.address,
          city: company.city !== undefined ? company.city : job.company?.city,
        };
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

      if (req.files?.logo?.[0]) {
        // New file uploaded — use it
        job.company.logo = req.files.logo[0].path.replace(/\\/g, "/");
      } else if (req.body?.logo_url) {
        // Reuse existing remote logo — keep as-is
        job.company.logo = req.body.logo_url;
      }

      // Append newly uploaded images to existing array
      if (req.files?.images?.length > 0) {
        const newImages = req.files.images.map((img) =>
          img.path.replace(/\\/g, "/")
        );
        job.images = [...(job.images || []), ...newImages];
      }

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

    await job.save();

    return successData(res, 200, true, `Step ${step} saved`, {
      id: job._id,
      slug: job.slug,
    });
  } catch (error) {
    console.warn("Job step error:", error);
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
    if (req.query.category_id) filter.category = req.query.category_id;
    if (req.query.sub_category_id)
      filter.subCategory = req.query.sub_category_id;

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

    if (req.query.userId !== undefined)
      filter.userId = req.query.userId;

    if (req.query.sector) filter.sector = req.query.sector;
    if (req.query.jobType) filter.jobType = req.query.jobType;
    if (req.query.workMode) filter.workMode = req.query.workMode;
    if (req.query.experienceLevel)
      filter.experienceLevel = req.query.experienceLevel;

    if (req.query.education) filter.education = req.query.education;
    if (req.query.gender) filter.gender = req.query.gender;

    if (req.query.city) filter["location.city"] = req.query.city;
    if (req.query.country) filter["location.country"] = req.query.country;

    // Remote filter
    if (req.query.isRemote === "true") {
      filter["location.isRemote"] = true;
    }

    // =========================
    // Salary Filter (NEW 🔥)
    // =========================
    if (req.query.salaryMin || req.query.salaryMax) {
      filter["salary.to"] = {};

      if (req.query.salaryMin) {
        filter["salary.to"].$gte = Number(req.query.salaryMin);
      }

      if (req.query.salaryMax) {
        filter["salary.to"].$lte = Number(req.query.salaryMax);
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
        { skills: { $in: [searchRegex] } },
      ];
    }

    // ✅ DEBUG: Log the final filter being passed to MongoDB
    console.log("Final MongoDB Filter:", JSON.stringify(filter, null, 2));

    // =========================
    // Query Execution
    // =========================
    const [
      jobs,
      total,
      totalAll,
      totalPending,
      totalApproved,
      totalRejected,
    ] = await Promise.all([
      Job.find(filter)
        .populate("category", "name")
        .populate("subCategory", "name")
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

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate("category", "name")
        .populate("subCategory", "name")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Job.countDocuments(filter),
    ]);

    if (!jobs.length)
      return errorData(res, 404, false, "No jobs found for this user");

    return successData(res, 200, true, "User jobs fetched successfully", {
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
      return successData(res, 200, true, "No previous company details found", []);
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
          jobId: job._id
        });
      }
    }

    return successData(res, 200, true, "Previous companies fetched", uniqueCompanies);
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

    const validModerationStatuses = ["pending", "approved", "rejected", "unapproved"];
    const validAvailableStatuses = ["open", "closed", "expired", "pending"];

    // If frontend sends everything via `status` property, elegantly route it
    if (status && !availableStatus) {
      if (["open", "closed", "expired"].includes(status)) {
        availableStatus = status;
        status = undefined; // Not a moderation status
      }
    }

    if (status && !validModerationStatuses.includes(status)) {
      return errorData(res, 400, false, "Invalid moderation status value");
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
            }
          );

          if (job.createdBy) {
            const pushTitle = status === "approved" ? "Job Listing Approved 🎉" : "Job Listing Rejected ❌";
            const pushBody = status === "approved" 
              ? `Congratulations! Your job listing "${job.title}" has been successfully approved.`
              : `We're sorry, your job listing "${job.title}" was rejected. ${rejectionReason ? 'Reason: ' + rejectionReason.trim() : ''}`;
            
            await sendPushNotification(job.createdBy, pushTitle, pushBody, {
              type: "JOB_LISTING_STATUS",
              listingId: job._id.toString(),
              status: status
            });
          }
        } catch (mailError) {
          console.warn("❌ Admin status mail/notification failed:", mailError.message);
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