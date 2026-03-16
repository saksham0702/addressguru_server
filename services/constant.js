import * as dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT;
export const API_PREFIX = process.env.API_PREFIX;
export const ADMIN_PREFIX = process.env.ADMIN_API;
export const USER_PREFIX = process.env.USER_API;
export const JWT_KEY = process.env.JWT_KEY;
export const SECRET_KEY = process.env.SECRET_KEY;
export const MONGODB_URL = process.env.MONGODB_URL;
export const BASE_URL = process.env.API_URL;
export const API_IMAGE_PREFIX = process.env.API_IMAGE_PREFIX;
export const NODE_ENV = process.env.NODE_ENV;

export const APP_BASE_URL = process.env.APP_BASE_URL;
export const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL;

export const APP_BUNDLE_ID = process.env.APP_BUNDLE_ID;

// Google Sign-In
export const GOOGLE_AUTH_URL = process.env.GOOGLE_AUTH_URL;
export const GOOGLE_TOKEN_URL = process.env.GOOGLE_TOKEN_URL;
export const GOOGLE_USERINFO_URL = process.env.GOOGLE_USERINFO_URL;

// Google Credentails
export const GOOGLE_IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID;
export const GOOGLE_ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID;
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Apple Sign-In
export const APPLE_AUTH_URL = process.env.APPLE_AUTH_URL;
export const APPLE_TOKEN_URL = process.env.APPLE_TOKEN_URL;

// Apple Credentails
export const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
export const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
export const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
export const APPLE_PRIVATE_KEY_PATH = process.env.APPLE_PRIVATE_KEY_PATH;

export const emailConfig = {
  SMTP_EMAIL: process.env.SMTP_EMAIL,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
};

export const defaultCities = [
  { name: "All Cities(UAE)", slug: "all-cities" },
  { name: "Abu Dhabi", slug: "abu-dhabi" },
  { name: "Dubai", slug: "dubai" },
  { name: "Sharjah", slug: "sharjah" },
  { name: "Ajman", slug: "ajman" },
  { name: "Umm Al Quwain", slug: "umm-al-quwain" },
  { name: "Ras Al Khaimah", slug: "ras-al-khaimah" },
  { name: "Fujairah", slug: "fujairah" },
  { name: "Al Ain", slug: "al-ain" },
];

// ROLES
export const ROLES = {
  ADMIN: 1,
  BDE: 2,
  LISTPARTNER: 3,
  USER: 4,
};

export const ROLE_NAMES = Object.fromEntries(
  Object.entries(ROLES).map(([k, v]) => [v, k]),
);

// API_PREFIX ROLES
export const ROLE_PREFIX = {
  ADMIN: "admin",
  BDE: "bde",
  LISTPARTNER: "listpartner",
  USER: "user",
};


// FOURSQUARE MAP API
export const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;

// GOOGLE
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
