// POST /api/impersonate/:userId
import JWT from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";
import User from "../model/userSchema.js";

const impersonateUser = async (req, res) => {
  try {
    console.log("REQQQ USER :", req?.user);
    console.log("REQQQ PARAMS :", req?.params);
    console.log("REQQQ QUERY :", req?.query);
    const masterAdmin = req.user;

    if (masterAdmin.user && masterAdmin?.user?.role !== "1") {
      return res.status(403).json({ message: "Access denied" });
    }

    const user = await User.findById(req?.params?.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = JWT.sign(
      {
        impersonated: true,
        masterAdminId: masterAdmin._id,
        userId: user._id,
        role: user.role,
      },
      SECRET_KEY,
      { expiresIn: "5m" } // expire in 5 minutes
    );

    res.json({ status: true, access_token: token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default impersonateUser;
