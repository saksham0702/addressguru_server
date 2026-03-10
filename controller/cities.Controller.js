import City from "../model/CitiesSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";

// GET /api/cities
export const getCities = async (req, res) => {
  try {
    const cities = await City.find({ deletedAt: null }); // exclude soft deleted
    if (!cities || cities.length === 0) {
      return errorData(res, 404, false, "No cities found");
    }
    return successData(
      res,
      200,
      true,
      "Fetched all cities successfully.",
      cities,
    );
  } catch (err) {
    console.error("Cities Error:", err); // ✅ fixed: was console.errorData
    return errorData(res, 500, false, "Server error while fetching cities");
  }
};
// POST /api/cities
// Body: { "cities": [{ "name": "Karachi", "slug": "karachi", "added_by": "adminId" }] }
export const addCities = async (req, res) => {
  try {
    // handle both: single object OR array
    const input = req.body.cities || req.body;
    const citiesToBeAdded = Array.isArray(input) ? input : [input];

    if (!citiesToBeAdded || citiesToBeAdded.length === 0) {
      return errorData(res, 400, false, "No cities to be added");
    }

    // auto-generate slug from name using slugify
    const prepared = citiesToBeAdded.map((city) => ({
      ...city,
      slug: slugify(city.name, { lower: true, strict: true }),
    }));

    const cities = await City.insertMany(prepared);
    return successData(res, 200, true, "Added cities successfully.", cities);
  } catch (error) {
    console.error("Cities Error:", error);
    return errorData(res, 500, false, "Server error while adding cities");
  }
};

// DELETE /api/cities/:id  → soft delete
export const deleteCity = async (req, res) => {
  try {
    const cityId = req.params.id;
    const city = await City.findOneAndUpdate(
      { _id: cityId, deletedAt: null }, // only delete if not already deleted
      { deletedAt: new Date() },
      { new: true },
    );
    if (!city) {
      return errorData(res, 404, false, "City not found");
    }
    return successData(res, 200, true, "Deleted city successfully.", city);
  } catch (error) {
    console.error("Cities Error:", error); // ✅ fixed
    return errorData(res, 500, false, "Server error while deleting city");
  }
};

// PUT /api/cities/:id
// Body: { "name": "Lahore", "slug": "lahore", "status": true }
export const updateCity = async (req, res) => {
  try {
    const cityId = req.params.id;
    const city = await City.findOneAndUpdate(
      { _id: cityId, deletedAt: null }, // prevent updating soft deleted cities
      req.body,
      { new: true },
    );
    if (!city) {
      return errorData(res, 404, false, "City not found");
    }
    return successData(res, 200, true, "Updated city successfully.", city);
  } catch (error) {
    console.error("Cities Error:", error); // ✅ fixed
    return errorData(res, 500, false, "Server error while updating city");
  }
};
