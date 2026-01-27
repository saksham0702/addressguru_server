import City from "../model/CitiesSchema.js";
import { successData, errorData } from "../services/helper.js";

export const getCities = async (req, res) => {
  try {
    const cities = await City.find();

    if (!cities || cities.length === 0) {
      return errorData(res, 404, false, "No cities found");
    }

    return successData(res, 200, true, "Fetched all cities successfully.", {
      cities,
    });
  } catch (err) {
    console.error("Cities Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching cities",
      error: err.message,
    });
  }
};
