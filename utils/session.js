import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../services/constant.js";

export function createSessionToken(user) {
  return jwt.sign(
    {
      sub: user._id,
      email: user.email,
      name: user.name,
    },
    SECRET_KEY,
    { expiresIn: "7d" }
  );
}

export function setSessionCookie(res, token) {
  res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN,
    maxAge: 7 * 24 * 3600 * 1000,
  });
}
