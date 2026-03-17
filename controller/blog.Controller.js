import Blog from "../model/blogsSchema.js";
import slugify from "slugify";
import { successData, errorData } from "../services/helper.js";
import BlogCategory from "../model/blogCategorySchema.js";
import fs from "fs";
import path from "path";

// ── Helper: delete old image file ─────────────────────────────────────────────
const deleteFile = (filePath) => {
  if (!filePath) return;
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
};

// ── Helper: format blog date for frontend ─────────────────────────────────────
const formatBlog = (blog) => {
  const obj = blog.toObject ? blog.toObject() : { ...blog };
  const dateSource = obj.publishedAt || obj.createdAt;
  return {
    ...obj,
    date: dateSource
      ? new Date(dateSource).toLocaleDateString("en-SG", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null,
  };
};

// ── GET /blogs ─────────────────────────────────────────────────────────────────
export const getBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const query = { status: "published" };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const total = await Blog.countDocuments(query);
    const blogs = await Blog.find(query)
      .populate("category_id", "name slug")
      .sort({ publishedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    return successData(res, 200, true, "Blogs fetched successfully", {
      blogs: blogs.map(formatBlog),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// ── GET /blogs/recent ─────────────────────────────────────────────────────────
export const getRecentBlogs = async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const blogs = await Blog.find({ status: "published" })
      .populate("category_id", "name slug")
      .sort({ publishedAt: -1 })
      .limit(Number(limit))
      .lean();

    return successData(res, 200, true, "Recent blogs fetched successfully", {
      blogs: blogs.map(formatBlog),
    });
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// ── GET /blogs/most-viewed ────────────────────────────────────────────────────
export const getMostViewedBlogs = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const blogs = await Blog.find({ status: "published" })
      .populate("category_id", "name slug")
      .sort({ views: -1 })
      .limit(Number(limit))
      .lean();

    return successData(
      res,
      200,
      true,
      "Most viewed blogs fetched successfully",
      {
        blogs: blogs.map(formatBlog),
      },
    );
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// ── GET /blogs/featured ───────────────────────────────────────────────────────
export const getFeaturedBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find({ status: "published", featured: true })
      .populate("category_id", "name slug")
      .sort({ publishedAt: -1 })
      .limit(6)
      .lean();

    return successData(res, 200, true, "Featured blogs fetched successfully", {
      blogs: blogs.map(formatBlog),
    });
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// ── GET /blogs/category/:categoryId ──────────────────────────────────────────
export const getBlogsByCategory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const query = { status: "published", category_id: req.params.categoryId };

    const total = await Blog.countDocuments(query);
    const blogs = await Blog.find(query)
      .populate("category_id", "name slug")
      .sort({ publishedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    return successData(
      res,
      200,
      true,
      "Blogs by category fetched successfully",
      {
        blogs: blogs.map(formatBlog),
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    );
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// ── GET /blogs/:slug ───────────────────────────────────────────────────────────
export const getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({
      slug: req.params.slug,
      status: "published",
    })
      .populate("category_id", "name slug")
      .populate("relatedPosts", "title slug coverImage publishedAt")
      .lean();

    if (!blog) return errorData(res, 404, false, "Blog not found");

    // Increment view count (fire and forget)
    Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } }).exec();

    return successData(
      res,
      200,
      true,
      "Blog fetched successfully",
      formatBlog(blog),
    );
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// ── POST /blogs/admin/blogs ───────────────────────────────────────────────────
export const createBlog = async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      category_id,
      tags,
      status,
      featured,
      relatedPosts,
      authorUserId,
      authorName,
      authorBio,
      authorJobTitle,
      authorTwitter,
      authorLinkedin,
      authorGithub,
      authorWebsite,
      seoTitle,
      seoDescription,
      seoKeywords,
      seoOgImage,
    } = req.body;

    if (!title) return errorData(res, 400, false, "Title is required");
    if (!authorName)
      return errorData(res, 400, false, "Author name is required");
    if (!content) return errorData(res, 400, false, "Content is required");

    // Auto-generate unique slug
    let slug = slugify(title, { lower: true, strict: true });
    const existing = await Blog.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;

    // Images from multer .fields()
    const coverImage = req.files?.coverImage?.[0]?.path || null;
    const authorAvatar = req.files?.authorAvatar?.[0]?.path || null;

    const blog = await Blog.create({
      title,
      slug,
      content,
      excerpt,
      coverImage,
      category_id,
      tags: tags ? JSON.parse(tags) : [],
      status: status || "draft",
      featured: featured === "true",
      relatedPosts: relatedPosts ? JSON.parse(relatedPosts) : [],
      author: {
        userId: authorUserId || undefined,
        name: authorName,
        avatar: authorAvatar,
        bio: authorBio,
        jobTitle: authorJobTitle,
        social: {
          twitter: authorTwitter,
          linkedin: authorLinkedin,
          github: authorGithub,
          website: authorWebsite,
        },
      },
      seo: {
        title: seoTitle,
        description: seoDescription,
        keywords: seoKeywords ? JSON.parse(seoKeywords) : [],
        ogImage: seoOgImage || coverImage,
      },
    });

    return successData(res, 201, true, "Blog created successfully", blog);
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// ── PUT /blogs/admin/blogs/:id ────────────────────────────────────────────────
export const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return errorData(res, 404, false, "Blog not found");

    const {
      title,
      content,
      excerpt,
      category_id,
      tags,
      status,
      featured,
      relatedPosts,
      authorUserId,
      authorName,
      authorBio,
      authorJobTitle,
      authorTwitter,
      authorLinkedin,
      authorGithub,
      authorWebsite,
      seoTitle,
      seoDescription,
      seoKeywords,
      seoOgImage,
    } = req.body;

    // New cover image → delete old
    if (req.files?.coverImage?.[0]) {
      deleteFile(blog.coverImage);
      blog.coverImage = req.files.coverImage[0].path;
    }

    // New author avatar → delete old
    if (req.files?.authorAvatar?.[0]) {
      deleteFile(blog.author?.avatar);
      blog.author = {
        ...(blog.author?.toObject?.() ?? blog.author),
        avatar: req.files.authorAvatar[0].path,
      };
    }

    // Re-slug only if title changed
    if (title && title !== blog.title) {
      let newSlug = slugify(title, { lower: true, strict: true });
      const conflict = await Blog.findOne({
        slug: newSlug,
        _id: { $ne: blog._id },
      });
      if (conflict) newSlug = `${newSlug}-${Date.now()}`;
      blog.slug = newSlug;
      blog.title = title;
    }

    if (content !== undefined) blog.content = content;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (category_id !== undefined) blog.category_id = category_id;
    if (tags !== undefined) blog.tags = JSON.parse(tags);
    if (status !== undefined) blog.status = status;
    if (featured !== undefined) blog.featured = featured === "true";
    if (relatedPosts !== undefined)
      blog.relatedPosts = JSON.parse(relatedPosts);

    blog.author = {
      userId: authorUserId ?? blog.author?.userId,
      name: authorName ?? blog.author?.name,
      avatar: blog.author?.avatar,
      bio: authorBio ?? blog.author?.bio,
      jobTitle: authorJobTitle ?? blog.author?.jobTitle,
      social: {
        twitter: authorTwitter ?? blog.author?.social?.twitter,
        linkedin: authorLinkedin ?? blog.author?.social?.linkedin,
        github: authorGithub ?? blog.author?.social?.github,
        website: authorWebsite ?? blog.author?.social?.website,
      },
    };

    blog.seo = {
      title: seoTitle ?? blog.seo?.title,
      description: seoDescription ?? blog.seo?.description,
      keywords: seoKeywords ? JSON.parse(seoKeywords) : blog.seo?.keywords,
      ogImage: seoOgImage ?? blog.seo?.ogImage,
    };

    await blog.save();

    return successData(res, 200, true, "Blog updated successfully", blog);
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// ── DELETE /blogs/admin/blogs/:id ─────────────────────────────────────────────
export const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return errorData(res, 404, false, "Blog not found");

    deleteFile(blog.coverImage);
    deleteFile(blog.author?.avatar);
    await blog.deleteOne();

    return successData(res, 200, true, "Blog deleted successfully");
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// ── GET /blogs/admin/blogs ────────────────────────────────────────────────────
export const adminGetAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (search) query.title = { $regex: search, $options: "i" };

    const total = await Blog.countDocuments(query);
    const blogs = await Blog.find(query)
      .populate("category_id", "name")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    return successData(res, 200, true, "All blogs fetched successfully", {
      blogs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// ── Blog Category Controllers ─────────────────────────────────────────────────

// GET /blogs/categories
export const getCategories = async (req, res) => {
  try {
    const categories = await BlogCategory.find()
      .sort({ name: 1 })
      .lean();

    const withCounts = await Promise.all(
      categories.map(async (cat) => ({
        ...cat,
        counts: await Blog.countDocuments({
          category_id: cat._id,
          status: "published",
        }),
      })),
    );

    return successData(
      res,
      200,
      true,
      "Categories fetched successfully",
      withCounts,
    );
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// POST /blogs/admin/categories
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return errorData(res, 400, false, "Category name is required");

    const slug = slugify(name, { lower: true, strict: true });
    const existing = await BlogCategory.findOne({ slug });
    if (existing) return errorData(res, 400, false, "Category already exists");

    const category = await BlogCategory.create({ name, slug, description });
    return successData(
      res,
      201,
      true,
      "Category created successfully",
      category,
    );
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// PUT /blogs/admin/categories/:id
export const updateCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const category = await BlogCategory.findById(req.params.id);
    if (!category) return errorData(res, 404, false, "Category not found");

    if (name && name !== category.name) {
      category.slug = slugify(name, { lower: true, strict: true });
      category.name = name;
    }
    if (description !== undefined) category.description = description;
    if (status !== undefined) category.status = status;

    await category.save();
    return successData(
      res,
      200,
      true,
      "Category updated successfully",
      category,
    );
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};

// DELETE /blogs/admin/categories/:id
export const deleteCategory = async (req, res) => {
  try {
    const category = await BlogCategory.findById(req.params.id);
    if (!category) return errorData(res, 404, false, "Category not found");

    await category.deleteOne();
    return successData(res, 200, true, "Category deleted successfully");
  } catch (error) {
    return errorData(res, 500, false, "Internal server error");
  }
};
