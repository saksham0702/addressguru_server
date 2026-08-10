import { successData, errorData } from "../../services/helper.js";
import { searchBusinesses } from "./businessSearch.service.js";
export const aiBusinessSearch = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string" || !query.trim()) {
      return errorData(res, 400, false, "query is required");
    }

    const { message, results } = await searchBusinesses(query.trim());

    return successData(res, 200, true, "AI search completed", {
      query: query.trim(),
      message,
      count: results.length,
      results,
    });
  } catch (error) {
    console.warn("AI business search error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export default { aiBusinessSearch };
