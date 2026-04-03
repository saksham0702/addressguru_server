// import JWT from "jsonwebtoken";
// import { SECRET_KEY } from "../services/constant.js";

// const createJwtToken = (user) => {
//   const jwtPayload = {
//     user: {
//       id: user._id,
//       role: user.role,
//       refId: user.refId,
//     },
//   };

//   return JWT.sign(jwtPayload, SECRET_KEY, { expiresIn: "24h" });
// };

// export default createJwtToken;


// utils/generateToken.js
import JWT from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";

const createJwtToken = (user, expiresIn = "24h") => {
  const jwtPayload = {
    user: {
      id: user._id,
      role: user.role,
      refId: user.refId,
      // impersonation fields (only set when impersonating)
      ...(user.impersonated && {
        impersonated: true,
        masterAdminId: user.masterAdminId,
      }),
    },
  };

  return JWT.sign(jwtPayload, SECRET_KEY, { expiresIn });
};

export default createJwtToken;