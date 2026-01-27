import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";

const authenticate = async (req, res, next) => {
  try {
    let token =
      req?.headers?.authorization?.split(" ")[1] || req?.cookies?.authToken;

    if (token) {
      const decoded = jwt.verify(token, SECRET_KEY);

      req.user = decoded;
      return next();
    }

    return res.status(401).json({
      status: false,
      message: "Unauthorized User: No token provided.",
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: false,
        message: "Token has expired",
      });
    }
    console.error("Authentication Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error.",
      error: error?.message,
    });
  }
};

export default authenticate;
