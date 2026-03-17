import multer from "multer";
import fs from "fs";
import path from "path";

// 🧩 Helper function to create dynamic folder path
const getUploadPath = (category) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleString("default", { month: "long" }); // e.g. "November"
  const day = String(now.getDate()).padStart(2, "0");

  // base upload directory
  const uploadDir = path.join(
    "uploads",
    category,
    `${year}`,
    `${month}`,
    `${day}`,
  );

  // ensure directory exists
  fs.mkdirSync(uploadDir, { recursive: true });

  return uploadDir;
};

// 🧩 Dynamic storage configuration
const storage = multer.diskStorage({
  // multer.js
  destination: function (req, file, cb) {
    console.log("file", req.files, file);
    // Priority: req._uploadFolder (set by middleware) > req.body.folder
    const folder = req._uploadFolder || req.body.folder;
    if (!folder) return cb(new Error("Folder (category) is required"), null);
    const uploadPath = getUploadPath(folder);
    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    console.log("file", req.files, file);

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const fileName = `${file.fieldname}-${uniqueSuffix}${ext}`;
    cb(null, fileName);
  },
});

// 🧩 Multer instance
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: function (req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

export default upload;

