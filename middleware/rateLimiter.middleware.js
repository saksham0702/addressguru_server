// middlewares/rateLimiter.js
import rateLimit from "express-rate-limit";

// General limiter — for all routes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window
  standardHeaders: true,     // Return rate limit info in headers
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again after 15 minutes"
  }
});

// Strict limiter — for auth routes (login, register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                   // only 10 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes"
  }
});

// Listing creation limiter
export const createListingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,                   // 20 listings per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Listing limit reached, please try again after an hour"
  }
});