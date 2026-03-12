// verifyAdmin.js — should ONLY check role, not re-verify token
const verifyAdmin = (req, res, next) => {
  // authenticate middleware already populated req.user
  if (!req.user) {
    return errorData(res, 401, false, "Unauthorized");
  }

  if (req.user.role !== "1") {
    return errorData(res, 403, false, "Access denied: Admin only");
  }

  next();
};

export default verifyAdmin;
