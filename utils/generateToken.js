import JWT from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";

const createJwtToken = (user) => {
  const jwtPayload = {
    user: {
      id: user._id,
      role: user.role,
      refId: user.refId,
    },
  };

  return JWT.sign(jwtPayload, SECRET_KEY, { expiresIn: "24h" });
};

export default createJwtToken;
