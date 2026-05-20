import City from "../model/CitiesSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";

// GET /api/cities
export const getCities = async (req, res) => {
  try {
    const { type, parent, search, includeDeleted = false } = req.query;

    const query = {};

    // existing behavior preserved
    if (!includeDeleted) {
      query.deletedAt = null;
    }

    // optional filters
    if (type) {
      query.type = type;
    }

    if (parent) {
      query.parent = parent;
    }

    // search support
    if (search) {
      query.name = {
        $regex: search,
        $options: "i",
      };
    }

    const cities = await City.find(query)
      .populate("parent", "name slug type")
      .sort({ name: 1 });

    if (!cities || cities.length === 0) {
      return errorData(res, 404, false, "No cities found");
    }

    return successData(res, 200, true, "Fetched cities successfully.", cities);
  } catch (err) {
    console.warn("Cities Error:", err);

    return errorData(res, 500, false, "Server error while fetching cities");
  }
};

// POST /api/cities
export const addCities = async (req, res) => {
  try {
    const input = req.body.cities || req.body;

    const citiesToBeAdded = Array.isArray(input) ? input : [input];

    if (!citiesToBeAdded || citiesToBeAdded.length === 0) {
      return errorData(res, 400, false, "No cities to be added");
    }

    const prepared = citiesToBeAdded.map((city) => ({
      ...city,

      slug: city.slug
        ? slugify(city.slug, {
            lower: true,
            strict: true,
          })
        : slugify(city.name, {
            lower: true,
            strict: true,
          }),

      type: city.type || "city",

      parent: city.parent || null,
    }));

    const cities = await City.insertMany(prepared);

    return successData(res, 200, true, "Added cities successfully.", cities);
  } catch (error) {
    console.warn("Cities Error:", error);

    return errorData(res, 500, false, "Server error while adding cities");
  }
};

// DELETE /api/cities/:id
export const deleteCity = async (req, res) => {
  try {
    const cityId = req.params.id;

    const city = await City.findOneAndUpdate(
      {
        _id: cityId,
        deletedAt: null,
      },
      {
        deletedAt: new Date(),
      },
      {
        new: true,
      },
    );

    if (!city) {
      return errorData(res, 404, false, "City not found");
    }

    return successData(res, 200, true, "Deleted city successfully.", city);
  } catch (error) {
    console.warn("Cities Error:", error);

    return errorData(res, 500, false, "Server error while deleting city");
  }
};

// PUT /api/cities/:id
export const updateCity = async (req, res) => {
  try {
    const cityId = req.params.id;

    const payload = { ...req.body };

    // auto update slug if name changes
    if (payload.name && !payload.slug) {
      payload.slug = slugify(payload.name, {
        lower: true,
        strict: true,
      });
    }

    const city = await City.findOneAndUpdate(
      {
        _id: cityId,
        deletedAt: null,
      },
      payload,
      {
        new: true,
      },
    ).populate("parent", "name slug type");

    if (!city) {
      return errorData(res, 404, false, "City not found");
    }

    return successData(res, 200, true, "Updated city successfully.", city);
  } catch (error) {
    console.warn("Cities Error:", error);

    return errorData(res, 500, false, "Server error while updating city");
  }
};
