// POST /api/impersonate/:userId
import JWT from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";
import User from "../model/userSchema.js";

const impersonateUser = async (req, res) => {
  try {
    const admin = req.user;

    // ✅ Allow only MASTER ADMIN
    if (admin.role !== "1") {
      return res.status(403).json({ message: "Access denied" });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Create impersonation token
    const token = JWT.sign(
      {
        id: user._id,
        role: user.role,
        impersonated: true,
        masterAdminId: admin.id,
      },
      SECRET_KEY,
      { expiresIn: "5m" },
    );

    // ✅ Store in httpOnly cookie
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 5 * 60 * 1000,
    });

    res.json({
      status: true,
      message: "Impersonation started",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default impersonateUser;
