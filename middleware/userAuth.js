import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";
import { errorData } from "../services/helper.js";

const authenticate = async (req, res, next) => {
  try {
    // ✅ Read token ONLY from cookie
    const token = req.cookies?.access_token;

    if (!token) {
      return errorData(res, 401, false, "Unauthorized: No token provided");
    }

    // ✅ Verify JWT
    const decoded = jwt.verify(token, SECRET_KEY);

    // ✅ Attach decoded payload
    // Example: { id, role }
    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return errorData(res, 401, false, "Session expired. Please login again.");
    }

    console.error("Authentication Error:", error);
    return errorData(res, 401, false, "Invalid authentication token");
  }
};

export default authenticate;
