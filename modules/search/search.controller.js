import { searchListingsService } from "./search.service.js";

export const searchListingsController = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query required",
      });
    }

    const data = await searchListingsService(q, Number(page), Number(limit));

    return res.json({
      success: true,
      query: q,
      total: data.total,
      page: data.page,
      totalPages: data.totalPages,
      results: data.results,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
};
