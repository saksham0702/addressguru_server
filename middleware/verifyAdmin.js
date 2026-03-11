import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";
import { errorData } from "../services/helper.js";

const verifyAdmin = async (req, res, next) => {
  try {
    // Read token from httpOnly cookie
    console.log("ALL COOKIES:", req.cookies); // 👈 add this
    console.log("ACCESS TOKEN:", req.cookies?.authToken); // 👈 add this
    const token = req.cookies?.authToken;

    if (!token) {
      return errorData(res, 401, false, "Unauthorized: No token provided");
    }


    // Verify JWT
    const decoded = jwt.verify(token, SECRET_KEY);
    console.log("DECODED:", decoded);
    console.log("ROLE:", decoded.user.role);
    console.log("TYPE:", typeof decoded.user.role);

    // Check admin role
    if (decoded.user.role !== "1") {
      return errorData(res, 403, false, "Access denied: Admin only");
    }

    // Attach user info
    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return errorData(res, 401, false, "Session expired. Please login again.");
    }

    console.error("Admin Verification Error:", error);
    return errorData(res, 401, false, "Invalid authentication token");
  }
};

export default verifyAdmin;
