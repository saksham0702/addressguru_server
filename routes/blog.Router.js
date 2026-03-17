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
} from "../controller/blog.controller.js";

const router = express.Router();

// Multer: two file fields in one request
const blogUpload = [
  (req, res, next) => {
    req._uploadFolder = "blogs";
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
router.get("/get-blog-by-slug/:slug", getBlogBySlug); // keep last
router.get("/get-blog-categories", getCategories);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get("/admin/get-all-blogs", adminGetAllBlogs);
router.post("/admin/create-blog", ...blogUpload, createBlog);
router.put("/admin/update-blog/:id", ...blogUpload, updateBlog);
router.delete("/admin/delete-blog/:id", deleteBlog);

router.post("/admin/create-category", createCategory);
router.put("/admin/update-category/:id", updateCategory);
router.delete("/admin/delete-category/:id", deleteCategory);

export default router;
