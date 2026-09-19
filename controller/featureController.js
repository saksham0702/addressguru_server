// controllers/featureController.js
import mongoose from "mongoose";
import Feature from "../model/featureSchema.js";
import CategoryFeature from "../model/categoryFeatures.js";
import slugify from "slugify";
import Category from "../model/categoriesSchema.js";
// helper
const normalizeFeatureName = (name) =>
  name.toLowerCase().replace(/[-\s_]+/g, "");

// ─── FEATURE CRUD ────────────────────────────────────────────────────────────
export const createFeature = async (req, res) => {
  try {
    const { name, type, iconSvg } = req.body;
    const slug = slugify(name, { lower: true, strict: true });
    const normalized = normalizeFeatureName(name);

    const allFeatures = await Feature.find(
      {},
      { name: 1, slug: 1, isDeleted: 1 },
    );

    const existingMatch = allFeatures.find(
      (f) => normalizeFeatureName(f.name) === normalized || f.slug === slug,
    );

    if (existingMatch) {
      if (existingMatch.isDeleted) {
        // Restore the deleted feature instead of creating a duplicate
        const restored = await Feature.findByIdAndUpdate(
          existingMatch._id,
          { isDeleted: false, type, iconSvg },
          { new: true },
        );
        return res
          .status(200)
          .json({ message: "Feature restored", data: restored });
      }

      // Truly active duplicate
      return res
        .status(409)
        .json({ message: "Feature with this name already exists" });
    }

    const feature = await Feature.create({ name, slug, type, iconSvg });
    res.status(201).json({ message: "Feature created", data: feature });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllFeatures = async (req, res) => {
  try {
    const { type, isActive } = req.query;

    const filter = { isDeleted: false };
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const features = await Feature.find(filter).sort({ createdAt: -1 });

    res.status(200).json({ message: "Features fetched", data: features });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getFeatureById = async (req, res) => {
  try {
    const feature = await Feature.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!feature) return res.status(404).json({ message: "Feature not found" });

    res.status(200).json({ message: "Feature fetched", data: feature });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateFeature = async (req, res) => {
  try {
    const { name, type, iconSvg, isActive } = req.body;
    const feature = await Feature.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!feature) return res.status(404).json({ message: "Feature not found" });

    if (name && name !== feature.name) {
      const slug = slugify(name, { lower: true, strict: true });
      const normalized = normalizeFeatureName(name);

      // Include deleted features in conflict check, exclude current doc
      const allFeatures = await Feature.find(
        { _id: { $ne: feature._id } }, // ← removed isDeleted: false
        { name: 1, slug: 1, isDeleted: 1 }, // ← fetch isDeleted too
      );

      const conflict = allFeatures.find(
        (f) => normalizeFeatureName(f.name) === normalized || f.slug === slug,
      );

      if (conflict) {
        // Only block if the conflicting feature is actually active
        if (!conflict.isDeleted) {
          return res.status(409).json({ message: "Name already taken" });
        }
      }

      feature.name = name;
      feature.slug = slug;
    }

    if (type !== undefined) feature.type = type;
    if (iconSvg !== undefined) feature.iconSvg = iconSvg;
    if (isActive !== undefined) feature.isActive = isActive;

    await feature.save();
    res.status(200).json({ message: "Feature updated", data: feature });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteFeature = async (req, res) => {
  try {
    const feature = await Feature.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true },
    );
    if (!feature) return res.status(404).json({ message: "Feature not found" });

    res.status(200).json({ message: "Feature deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── ASSIGN FEATURES TO CATEGORY ─────────────────────────────────────────────

export const assignFeaturesToCategory = async (req, res) => {
  console.log(req.params);
  console.log(req.body);
  try {
    const { categoryId } = req.params;
    const {
      facilities = [],
      services = [],
      courses = [],
      payment_modes = [],
    } = req.body;

    // Filter valid Mongo ObjectIds
    const allIds = [...facilities, ...services, ...courses, ...payment_modes];
    const validObjectIds = allIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );

    let validIds = new Set();
    if (validObjectIds.length > 0) {
      const validFeatures = await Feature.find({
        _id: { $in: validObjectIds },
        isDeleted: false,
      }).select("_id");
      validIds = new Set(validFeatures.map((f) => f._id.toString()));
    }

    // Keep only valid IDs for each array
    const validFacilities = facilities.filter((id) =>
      validIds.has(id?.toString()),
    );
    const validServices = services.filter((id) =>
      validIds.has(id?.toString()),
    );
    const validCourses = courses.filter((id) =>
      validIds.has(id?.toString()),
    );
    const validPaymentModes = payment_modes.filter((id) =>
      validIds.has(id?.toString()),
    );

    // Upsert: create pivot doc if not exists, else add to arrays (no duplicates)
    const updateOps = {};
    if (validFacilities.length) updateOps.facilities = { $each: validFacilities };
    if (validServices.length) updateOps.services = { $each: validServices };
    if (validCourses.length) updateOps.courses = { $each: validCourses };
    if (validPaymentModes.length) updateOps.payment_modes = { $each: validPaymentModes };

    const updateQuery = Object.keys(updateOps).length ? { $addToSet: updateOps } : {};

    const categoryFeature = await CategoryFeature.findOneAndUpdate(
      { category: categoryId },
      updateQuery,
      { upsert: true, new: true },
    ).populate("facilities services courses payment_modes");

    if (categoryFeature) {
      categoryFeature.facilities = (categoryFeature.facilities || []).filter(Boolean);
      categoryFeature.services = (categoryFeature.services || []).filter(Boolean);
      categoryFeature.courses = (categoryFeature.courses || []).filter(Boolean);
      categoryFeature.payment_modes = (categoryFeature.payment_modes || []).filter(Boolean);
    }

    res.status(200).json({
      message: "Features assigned to category",
      data: categoryFeature,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const removeFeatureFromCategory = async (req, res) => {
  try {
    const { categoryId, featureId } = req.params;
    const { featureType } = req.body; // "facilities" | "services" | "courses" | "payment_modes"

    const validTypes = ["facilities", "services", "courses", "payment_modes"];
    if (!validTypes.includes(featureType)) {
      return res.status(400).json({
        message:
          "Invalid featureType. Must be one of: " + validTypes.join(", "),
      });
    }

    const categoryFeature = await CategoryFeature.findOneAndUpdate(
      { category: categoryId },
      { $pull: { [featureType]: featureId } },
      { new: true },
    ).populate("facilities services courses payment_modes");

    if (!categoryFeature) {
      return res
        .status(404)
        .json({ message: "No feature mapping found for this category" });
    }

    categoryFeature.facilities = (categoryFeature.facilities || []).filter(Boolean);
    categoryFeature.services = (categoryFeature.services || []).filter(Boolean);
    categoryFeature.courses = (categoryFeature.courses || []).filter(Boolean);
    categoryFeature.payment_modes = (categoryFeature.payment_modes || []).filter(Boolean);

    res.status(200).json({
      message: "Feature removed from category",
      data: categoryFeature,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getCategoryFeatures = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const categoryFeature = await CategoryFeature.findOne({
      category: categoryId,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    })
      .populate("category", "name slug iconSvg isActive seo tags isPopular")
      .populate("facilities services courses payment_modes");

    if (!categoryFeature) {
      const category = await Category.findById(categoryId).select(
        "name slug iconSvg isActive seo tags",
      );

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      return res.status(200).json({
        message: "Category fetched (no features assigned yet)",
        data: {
          category,
          facilities: [],
          services: [],
          courses: [],
          payment_modes: [],
        },
      });
    }

    categoryFeature.facilities = (categoryFeature.facilities || []).filter(Boolean);
    categoryFeature.services = (categoryFeature.services || []).filter(Boolean);
    categoryFeature.courses = (categoryFeature.courses || []).filter(Boolean);
    categoryFeature.payment_modes = (categoryFeature.payment_modes || []).filter(Boolean);

    res
      .status(200)
      .json({ message: "Category features fetched", data: categoryFeature });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const assignFeaturesToSubCategory = async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.params;
    const {
      facilities = [],
      services = [],
      courses = [],
      payment_modes = [],
    } = req.body;

    const allIds = [...facilities, ...services, ...courses, ...payment_modes];
    const validObjectIds = allIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );

    let validIds = new Set();
    if (validObjectIds.length > 0) {
      const validFeatures = await Feature.find({
        _id: { $in: validObjectIds },
        isDeleted: false,
      }).select("_id");
      validIds = new Set(validFeatures.map((f) => f._id.toString()));
    }

    const validFacilities = facilities.filter((id) =>
      validIds.has(id?.toString()),
    );
    const validServices = services.filter((id) =>
      validIds.has(id?.toString()),
    );
    const validCourses = courses.filter((id) =>
      validIds.has(id?.toString()),
    );
    const validPaymentModes = payment_modes.filter((id) =>
      validIds.has(id?.toString()),
    );

    const updateOps = {};
    if (validFacilities.length) updateOps.facilities = { $each: validFacilities };
    if (validServices.length) updateOps.services = { $each: validServices };
    if (validCourses.length) updateOps.courses = { $each: validCourses };
    if (validPaymentModes.length) updateOps.payment_modes = { $each: validPaymentModes };

    const updateQuery = Object.keys(updateOps).length ? { $addToSet: updateOps } : {};

    const categoryFeature = await CategoryFeature.findOneAndUpdate(
      { category: categoryId, subcategory: subcategoryId },
      updateQuery,
      { upsert: true, new: true },
    ).populate(
      "category subcategory facilities services courses payment_modes",
    );

    if (categoryFeature) {
      categoryFeature.facilities = (categoryFeature.facilities || []).filter(Boolean);
      categoryFeature.services = (categoryFeature.services || []).filter(Boolean);
      categoryFeature.courses = (categoryFeature.courses || []).filter(Boolean);
      categoryFeature.payment_modes = (categoryFeature.payment_modes || []).filter(Boolean);
    }

    res.status(200).json({
      message: "Features assigned to subcategory",
      data: categoryFeature,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const removeFeatureFromSubCategory = async (req, res) => {
  try {
    const { categoryId, subcategoryId, featureId } = req.params;
    const { featureType } = req.body;

    const validTypes = ["facilities", "services", "courses", "payment_modes"];
    if (!validTypes.includes(featureType)) {
      return res.status(400).json({
        message:
          "Invalid featureType. Must be one of: " + validTypes.join(", "),
      });
    }

    const categoryFeature = await CategoryFeature.findOneAndUpdate(
      { category: categoryId, subcategory: subcategoryId },
      { $pull: { [featureType]: featureId } },
      { new: true },
    ).populate(
      "category subcategory facilities services courses payment_modes",
    );

    if (!categoryFeature) {
      return res
        .status(404)
        .json({ message: "No feature mapping found for this subcategory" });
    }

    categoryFeature.facilities = (categoryFeature.facilities || []).filter(Boolean);
    categoryFeature.services = (categoryFeature.services || []).filter(Boolean);
    categoryFeature.courses = (categoryFeature.courses || []).filter(Boolean);
    categoryFeature.payment_modes = (categoryFeature.payment_modes || []).filter(Boolean);

    res.status(200).json({
      message: "Feature removed from subcategory",
      data: categoryFeature,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getSubCategoryFeatures = async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.params;

    const categoryFeature = await CategoryFeature.findOne({
      category: categoryId,
      subcategory: subcategoryId,
    }).populate(
      "category subcategory facilities services courses payment_modes",
    );

    if (!categoryFeature) {
      return res
        .status(404)
        .json({ message: "No features assigned to this subcategory yet" });
    }

    categoryFeature.facilities = (categoryFeature.facilities || []).filter(Boolean);
    categoryFeature.services = (categoryFeature.services || []).filter(Boolean);
    categoryFeature.courses = (categoryFeature.courses || []).filter(Boolean);
    categoryFeature.payment_modes = (categoryFeature.payment_modes || []).filter(Boolean);

    res
      .status(200)
      .json({ message: "Subcategory features fetched", data: categoryFeature });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
