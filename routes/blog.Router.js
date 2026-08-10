// routes/blog.routes.js
import express from "express";
import upload from "../middleware/multerConfig.js";
import {
  getBlogs,
  getRecentBlogs,
  getMostViewedBlogs,
  getFeaturedBlogs,
  getBlogsByCategory,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  adminGetAllBlogs,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reviewBlog,
  getBlogsByUser,
} from "../controller/blog.Controller.js";
import { authenticate, optionalAuth } from "../middleware/userAuth.js";

const router = express.Router();

// Multer: two file fields in one request
const blogUpload = [
  (req, res, next) => {
    req._uploadFolder = "blogs"; // ✅ SET THIS
    next();
  },
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "authorAvatar", maxCount: 1 },
  ]),
];

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/get-blogs", getBlogs);
router.get("/get-recent-blogs", getRecentBlogs);
router.get("/get-most-viewed-blogs", getMostViewedBlogs);
router.get("/get-featured-blogs", getFeaturedBlogs);
router.get("/get-blogs-by-category/:categoryId", getBlogsByCategory);
router.get("/get-blog-by-slug/:slug", optionalAuth, getBlogBySlug);
router.get("/get-blog-categories", getCategories);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get("/admin/get-all-blogs", adminGetAllBlogs);
router.post("/admin/create-blog", authenticate, ...blogUpload, createBlog);
router.put("/admin/update-blog/:id", authenticate, ...blogUpload, updateBlog);
router.delete("/admin/delete-blog/:id", deleteBlog);

router.post("/admin/create-category", createCategory);
router.put("/admin/update-category/:id", updateCategory);
router.delete("/admin/delete-category/:id", deleteCategory);
router.put("/admin/review-blog/:id", authenticate, reviewBlog);

router.get("/user/:userId", authenticate, getBlogsByUser);
export default router;
