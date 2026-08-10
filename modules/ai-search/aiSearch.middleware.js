import rateLimit from "express-rate-limit";

export const aiSearchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 8, // 8 AI searches per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many search requests. Please wait a moment and try again.",
  },
});

export const validateSearchQuery = (req, res, next) => {
  const { query } = req.body;

  if (!query || typeof query !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "query is required" });
  }

  const trimmed = query.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (trimmed.length < 4 || wordCount < 2) {
    return res.status(400).json({
      success: false,
      message:
        "Please describe what kind of business or service you're looking for.",
    });
  }

  if (trimmed.length > 300) {
    return res
      .status(400)
      .json({ success: false, message: "Query is too long." });
  }

  next();
};
