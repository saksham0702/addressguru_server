import Job from "../model/jobsListingSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";

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
//         postedBy: req.user?.id || null, // Assuming you have req.user from auth middleware
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
//     console.error("Job step error:", error);
//     return errorData(res, 500, false, "Internal server error");
//   }
// };

export const saveJobStep = async (req, res) => {
  try {
    const { job_id, slug } = req?.body;
    const step = Number(req?.params?.step);
    const user = req?.user;
    const method = req?.method; // POST / PUT

    let job = null;
    console.log("REQQ BODYY :", req.body);


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

      if (job.postedBy?.toString() !== user?.id && user?.role !== "admin") {
        return errorData(res, 403, false, "Unauthorized");
      }
    }

    /* =========================
       METHOD VALIDATION
    ========================== */

    if (method === "POST" && step !== 1) {
      return errorData(res, 400, false, "POST allowed only for Step 1 (create job)");
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
        experienceYears,
        gender,
        ageRange,
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
          skills: Array.isArray(skills)
            ? skills
            : [skills].filter(Boolean),
          sector,
          jobType,
          workMode,
          experienceLevel,
          totalPositions: total_positions || 1,
          salary,
          location,
          education,
          experienceYears,
          gender,
          ageRange,
          slug: baseSlug,
          postedBy: user?.id,
          status: "pending",
        });

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

        if (skills)
          job.skills = Array.isArray(skills)
            ? skills
            : [skills];

        if (sector) job.sector = sector;
        if (jobType) job.jobType = jobType;
        if (workMode) job.workMode = workMode;
        if (experienceLevel) job.experienceLevel = experienceLevel;
        if (total_positions) job.totalPositions = total_positions;
        if (salary) job.salary = salary;
        if (location) job.location = location;
        if (education) job.education = education;
        if (experienceYears) job.experienceYears = experienceYears;
        if (gender) job.gender = gender;
        if (ageRange) job.ageRange = ageRange;
      }
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
          logo: job.company?.logo,
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

      if (application_deadline)
        job.applicationDeadline = application_deadline;

      if (req.files?.logo?.[0]) {
        job.company.logo = req.files.logo[0].path;
      }

      if (req.files?.images?.length) {
        const imgs = req.files.images.map((i) => i.path);
        job.images = [...(job.images || []), ...imgs];
      }

      job.status = "active";
      job.isActive = true;
    }

    await job.save();

    return successData(res, 200, true, `Step ${step} saved`, {
      id: job._id,
      slug: job.slug,
    });
  } catch (error) {
    console.error("Job step error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

/* =========================
   GET ALL JOBS
========================== */
export const getAllJobsWithPaginationAndFilters = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Base query
    const filter = {
      isDeleted: false,
      isActive: true,
      status: "active",
    };

    // Apply optional string filters
    if (req.query.category_id) filter.category = req.query.category_id;
    if (req.query.sub_category_id) filter.subCategory = req.query.sub_category_id;
    if (req.query.sector) filter.sector = req.query.sector;
    if (req.query.jobType) filter.jobType = req.query.jobType;
    if (req.query.workMode) filter.workMode = req.query.workMode;
    if (req.query.experienceLevel) filter.experienceLevel = req.query.experienceLevel;
    if (req.query.education) filter.education = req.query.education;
    if (req.query.gender) filter.gender = req.query.gender;
    if (req.query.city) filter["location.city"] = req.query.city;
    if (req.query.country) filter["location.country"] = req.query.country;

    // Remote works overrides/adds to workMode
    if (req.query.isRemote === "true") {
      filter["location.isRemote"] = true;
    }

    // Text search filter
    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: 'i' };
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
      return errorData(res, 404, false, "No jobs found");

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
    console.error("Job fetch error:", error);
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

    if (!job) return errorData(res, 404, false, "Job not found", {
      slug: slug,
    });

    return successData(res, 200, true, "Job fetched successfully", job);
  } catch (error) {
    console.error("Job fetch err:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};


/* =========================
   SOFT DELETE JOB
========================== */
export const deleteJob = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return errorData(res, 400, false, "Job Slug is required");

    const job = await Job.findOneAndUpdate(
      { slug: slug },
      { isDeleted: true, status: "closed", isActive: false },
      { new: true },
    );

    if (!job) return errorData(res, 404, false, "Job not found");

    return successData(res, 200, true, "Job deleted successfully", {
      slug: job.slug,
    });
  } catch (error) {
    console.error("Job delete error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
