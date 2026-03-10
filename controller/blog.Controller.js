import Blog from "../model/blogsSchema.js";
import slugify from "slugify";
import BlogCategory from "../model/blogCategorySchema.js";

export const createBlog = async (req, res) => {
    try {
        const { title, content, category_id } = req.body;
        const slug = slugify(title, { lower: true, strict: true });
        const blog = await Blog.create({ title, content, category_id, slug, });
        res.status(201).json({ message: "Blog created", data: blog });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getBlogByCategory = async (req, res) => {
    try {
        const { category_id } = req.params;
        const blogs = await Blog.find({ category_id });
        res.status(200).json({ message: "Blogs fetched", data: blogs });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getBlogBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const blog = await Blog.findOne({ slug });
        res.status(200).json({ message: "Blog fetched", data: blog });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const blog = await Blog.findByIdAndUpdate(id, req.body, { new: true });
        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }
        res.status(200).json({ message: "Blog updated", data: blog });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const blog = await Blog.findByIdAndDelete(id);
        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }
        res.status(200).json({ message: "Blog deleted", data: blog });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getAllBlogs = async (req, res) => {
    try {
        const blogs = await Blog.find();
        res.status(200).json({ message: "Blogs fetched", data: blogs });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

