// routes/authGoogle.js
import express from "express";
import axios from "axios";
import querystring from "querystring";
import { createSessionToken, setSessionCookie } from "../utils/session.js";
import User from "../model/userSchema.js";
import crypto from "crypto";
import {
  APP_BASE_URL,
  APP_BUNDLE_ID,
  APPLE_AUTH_URL,
  APPLE_CLIENT_ID,
  APPLE_KEY_ID,
  APPLE_PRIVATE_KEY_PATH,
  APPLE_TEAM_ID,
  APPLE_TOKEN_URL,
  BACKEND_BASE_URL,
  GOOGLE_AUTH_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
} from "../services/constant.js";
import { OAuth2Client } from "google-auth-library";
import appleSignin from "apple-signin-auth";

const router = express.Router();

function genState() {
  return crypto.randomBytes(16).toString("hex");
}

function createClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: APPLE_TEAM_ID,
    iat: now,
    exp: now + 15777000, // 6 months recommended max
    aud: "https://appleid.apple.com",
    sub: APPLE_CLIENT_ID,
  };
  const header = {
    kid: APPLE_KEY_ID,
    alg: "ES256",
  };
  return jwt.sign(payload, privateKey, { algorithm: "ES256", header });
}

// Load private key content (p8)
// const privateKey = fs.readFileSync(APPLE_PRIVATE_KEY_PATH, "utf8");
const privateKey = "";

async function findOrCreateUser({
  provider,
  providerId,
  email,
  firstName = "",
  lastName = "",
  displayName = "",
  avatarUrl,
}) {
  // 1️⃣ Match by provider (already linked)
  let user = await User.findOne({
    "socialLogins.provider": provider,
    "socialLogins.providerId": providerId,
  });

  if (user) {
    user.lastLogin = new Date();
    await user.save();
    return user;
  }

  // 2️⃣ Match by email (MAIN RULE)
  if (email) {
    user = await User.findOne({ email });

    if (user) {
      const alreadyLinked = user.socialLogins.some(
        (s) => s.provider === provider,
      );

      if (!alreadyLinked) {
        user.socialLogins.push({ provider, providerId });
      }

      user.lastLogin = new Date();
      await user.save();
      return user;
    }
  }

  // 3️⃣ Create new user
  user = await User.create({
    firstName,
    lastName,
    displayName,
    email,
    login_type: provider,
    username: email?.split("@")[0] || `${provider}_${providerId.slice(0, 6)}`,
    usernameSetup: false,
    avatar: avatarUrl ? avatarUrl : undefined,
    socialLogins: [{ provider, providerId }],
    password: null,
    isVerified: true,
    createdAt: new Date(),
    lastLogin: new Date(),
  });

  return user;
}

router.get("/", (req, res) => {
  res.send(`
    <h1 style="text-align:center;">
      Welcome to AddressGuru UAE Backend Social Login Router
    </h1>
  `);
});

router.get("/google", (req, res) => {
  const state = genState();
  res.cookie("oauth_state", state, { httpOnly: true, maxAge: 5 * 60 * 1000 });
  const params = {
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${BACKEND_BASE_URL}/social-login/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  };
  res.redirect(`${GOOGLE_AUTH_URL}?${querystring.stringify(params)}`);
});

router.get("/google/callback", async (req, res) => {
  console.log("REQQ QUERY :;", req?.query);
  const { code, state } = req.query;
  const savedState = req.cookies.oauth_state;
  res.clearCookie("oauth_state");

  if (!state || state !== savedState) {
    return res.status(400).send("Invalid state");
  }

  try {
    const tokenResp = await axios.post(
      GOOGLE_TOKEN_URL,
      querystring.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${BACKEND_BASE_URL}/social-login/google/callback`,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { id_token, access_token, refresh_token } = tokenResp.data;

    const userInfoResp = await axios.get(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const userInfo = userInfoResp.data;

    let user = await User.findOne({
      provider: "google",
      providerId: userInfo.sub,
    });
    if (!user) {
      user = await User.create({
        // provider: "google",
        // providerId: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        socialLogins: [{ provider: "google", providerId: userInfo.sub }],
        createdAt: new Date(),
      });
    } else {
      user.lastLoginAt = new Date();
      await user.save();
    }

    if (refresh_token) {
      // encrypt and store
      user.refreshTokenEncrypted = encrypt(refresh_token);
      await user.save();
    }

    const sessionToken = createSessionToken(user);
    setSessionCookie(res, sessionToken);

    // Redirect to frontend app
    res.redirect(`${APP_BASE_URL}/auth/success`);
  } catch (err) {
    console.error(err.response?.data || err);
    res.redirect(`${APP_BASE_URL}/auth/error`);
  }
});

router.get("/apple", (req, res) => {
  const state = genState();
  res.cookie("oauth_state", state, { httpOnly: true, maxAge: 5 * 60 * 1000 });
  const params = {
    response_type: "code id_token",
    response_mode: "form_post", // apple allows form_post or query
    client_id: APPLE_CLIENT_ID,
    redirect_uri: `${BACKEND_BASE_URL}/social-login/apple/callback`,
    scope: "name email",
    state,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  res.redirect(`${APPLE_AUTH_URL}?${querystring.stringify(params)}`);
});

router.post(
  "/apple/callback",
  express.urlencoded({ extended: true }),
  async (req, res) => {
    const { code, state, id_token } = req.body; // Apple may provide id_token
    const savedState = req.cookies.oauth_state;
    res.clearCookie("oauth_state");

    if (!state || state !== savedState) {
      return res.status(400).send("Invalid state");
    }

    try {
      // Exchange code for tokens
      const clientSecret = createClientSecret();
      const tokenResp = await axios.post(
        APPLE_TOKEN_URL,
        querystring.stringify({
          client_id: APPLE_CLIENT_ID,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: `${BACKEND_BASE_URL}/social-login/apple/callback`,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const {
        id_token: appleIdToken,
        access_token,
        refresh_token,
      } = tokenResp.data;
      // Verify appleIdToken (it's a JWT) - verify signature using Apple's publicly available keys (kid header)
      // For brevity, you can verify with a library that handles JWKS; or decode id_token to get sub (apple user id) and email
      const decoded = jwt.decode(appleIdToken);

      // decoded.sub is unique Apple user id
      let user = await User.findOne({
        provider: "apple",
        providerId: decoded.sub,
      });
      if (!user) {
        // Apple returns name only during first sign-in via the initial POST; if not available, you may prompt user to complete profile
        user = await User.create({
          provider: "apple",
          providerId: decoded.sub,
          email: decoded.email || undefined,
          name: decoded.name || undefined,
          createdAt: new Date(),
        });
      } else {
        user.lastLoginAt = new Date();
        await user.save();
      }

      // Optionally store refresh_token
      if (refresh_token) {
        user.refreshTokenEncrypted = encrypt(refresh_token);
        await user.save();
      }

      const sessionToken = createSessionToken(user);
      setSessionCookie(res, sessionToken);
      res.redirect(`${APP_BASE_URL}/auth/success`);
    } catch (err) {
      console.error(err.response?.data || err);
      res.redirect(`${APP_BASE_URL}/auth/error`);
    }
  }
);


router.post("/auth/exchange", async (req, res) => {
  const {
    provider,
    idToken,
    accessToken,
    identityToken,
    code,
    redirect_uri,
    email,
    fullName,
    lastName,
    platform,
  } = req?.body;

  console.log("REQQ BODYYY ::", req?.body);

  try {
    let userData = null;

    /* ===================== GOOGLE ===================== */
    if (provider === "google") {
      const clientId =
        platform === "ios"
          ? GOOGLE_IOS_CLIENT_ID
          : GOOGLE_CLIENT_ID

      const client = new OAuth2Client(clientId);

      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });

      const g = ticket.getPayload();

      userData = {
        provider: "google",
        providerId: g?.sub,
        email: g?.email,
        firstName: g?.given_name,
        lastName: g?.family_name,
        displayName: g?.name,
        avatarUrl: g?.picture,
      };
    }

    /* ===================== APPLE ===================== */
    if (provider === "apple") {
      const decoded = await appleSignin.verifyIdToken(identityToken, {
        audience: APP_BUNDLE_ID,
      });

      userData = {
        provider: "apple",
        providerId: decoded?.sub,
        email: email || decoded?.email || null, // may be null
        firstName: fullName || "",
        lastName: lastName || "",
        displayName: fullName || "",
      };
    }

    if (!userData) {
      return res.status(400).json({ error: "unsupported provider" });
    }

    console.log("USER DATTA ::", userData);


    /* ===================== FINAL LINK / CREATE ===================== */
    const user = await findOrCreateUser(userData);
    const accessToken = createSessionToken(userData);


    // user.refreshTokens.push({ token: refreshToken });
    // await user.save();

    return res.status(200).json({
      success: true,
      data: { user: userData, accessToken },
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.status(500).json({ error: "auth_exchange_failed" });
  }
});




export default router;
