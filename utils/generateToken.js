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
  const userRoles = Array.isArray(user.roles) && user.roles.length > 0
    ? user.roles
    : user.role
      ? [Number(user.role)]
      : [5];

  const primaryRole = userRoles[0] || 5;

  const jwtPayload = {
    user: {
      id: user._id || user.id,
      _id: user._id || user.id,
      roles: userRoles,
      role: primaryRole,
      refId: user.refId,
      email: user.email,
      name: user.name,
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