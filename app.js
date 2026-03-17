import { fileURLToPath } from "url";
import path, { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import createError from "http-errors";
import express from "express";
import cookieParser from "cookie-parser";
import logs from "morgan";
import cors from "cors";
import logger from "./services/logger.js";

// import indexRouter from "./routes/index.js";
// import usersRouter from "./routes/users.js";

import masterAdminRouter from "./routes/masterAdmiRouter.js";
import usersRouter from "./routes/userRouter.js";
import citiesRouter from "./routes/citiesRouter.js";
import socialRouter from "./routes/socialRouter.js";
import categoryRouter from "./routes/categoriesRouter.js";
import connectDB from "./config/connectDB.js";
// import { API_PREFIX, ROLE_PREFIX } from "./services/constant.js";
import errorHandlerMiddleware from "./middleware/error-handler.middleware.js";
import subCategoriesRouter from "./routes/subCategoriesRouter.js";
// import { seedFeatures } from "./seeds/feature.seed.js";
import businessListingRouter from "./routes/businessListingRouter.js";
import jobsListingRouter from "./routes/jobsListingRouter.js";
import additionalFieldRouter from "./routes/additionalField.Router.js";
import featureRouter from "./routes/feature.Router.js";
import adminUserRouter from "./routes/adminUser.Router.js";
import marketplaceListingRouter from "./routes/marketplaceRouter.js";
import blogRouter from "./routes/blog.Router.js";

var app = express();

// view engine setup
app.set("trust proxy", true);
app.set("views", join(__dirname, "views"));
app.set("view engine", "jade");
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3002",
  "http://localhost:3001",
  "https://addressguru.ae",
  "*",
  // Add any other frontend origins here
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(logs("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(express.static(join(__dirname, "public")));

// Serve uploaded images publicly
// app.use("/uploads", express.static(path.join(process.cwd(), "public")));
app.use("/uploads", express.static(join(process.cwd(), "uploads")));

app.get("/api", async (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>AddressGuru UAE Backend</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f0f2f5;
          color: #333;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          text-align: center;
          background: white;
          padding: 2rem 3rem;
          box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        h1 {
          color: #FF6E02;
        }
        p {
          font-size: 1.2rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 AddressGuru UAE Backend</h1>
        <p>Server is up and running smoothly!</p>
      </div>
    </body>
    </html>
  `;
  return res.send(html);
});

app.use(`/additional-fields`, additionalFieldRouter);
app.use(`/master`, masterAdminRouter);
app.use(`/social-login`, socialRouter);
app.use(`/categories`, categoryRouter);
app.use(`/sub-categories`, subCategoriesRouter);
app.use(`/business-listing`, businessListingRouter);
app.use(`/marketplace`, marketplaceListingRouter);
app.use(`/cities`, citiesRouter);
// app.use(`/${API_PREFIX}/${ROLE_PREFIX.USER}`, usersRouter);
app.use(`/user`, usersRouter);
app.use(`/jobs-listing`, jobsListingRouter);
app.use(`/admin/users`, adminUserRouter);
app.use(`/features`, featureRouter);
app.use(`/blogs`, blogRouter);

app.get("/test-cookie", (req, res) => {
  console.log("cookies:", req.cookies);
  res.json({ message: "SERVER", cookies: req.cookies });
});

// app.use("/", indexRouter);
// app.use("/users", usersRouter);

// Connect to Database
connectDB();
// await seedFeatures();

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(errorHandlerMiddleware);

app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  // Log error with Winston
  logger.error(
    `${err.status || 500} - ${err.message} - ${req.originalUrl} - ${
      req.method
    } - ${req.ip}`,
  );

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

export default app;
