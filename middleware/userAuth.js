import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";
import { errorData } from "../services/helper.js";

const authenticate = async (req, res, next) => {
  try {
    // ✅ Read token ONLY from cookie
    const token = req.cookies?.authToken;
    console.log("REQQ COOKIES :".req.cookies);
    if (!token) {
      return errorData(res, 401, false, "Unauthorized: No token provided");
    }
    // ✅ Verify JWT
    const decoded = jwt.verify(token, SECRET_KEY);
    // ✅ Attach decoded payload
    // Example: { id, role }
    req.user = decoded?.user;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return errorData(res, 401, false, "Session expired. Please login again.");
    }
    console.error("Authentication Error:", error);
    return errorData(res, 401, false, "Invalid authentication token");
  }
};

const optionalAuth = (req, res, next) => {
  try {
    const token = req.cookies?.authToken;
    if (token) {
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded?.user; // same shape your middleware uses
    } else {
      req.user = null;
    }
  } catch {
    req.user = null; // expired / invalid token → treat as guest
  }
  next();
};

export { authenticate, optionalAuth };
