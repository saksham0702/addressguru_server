// middlewares/resumeUpload.js
import multer from "multer";
import path from "path";
import fs from "fs";

// ─── Allowed file types ───────────────────────────────────────
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_EXT = [".pdf", ".doc", ".docx"];
const MAX_SIZE_MB  = 5;

// ─── Disk storage ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/resumes";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `resume-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  },
});

// ─── File filter ──────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ALLOWED_TYPES.includes(file.mimetype) && ALLOWED_EXT.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "Only PDF, DOC, and DOCX files are allowed"
      ),
      false
    );
  }
};

// ─── Export upload middleware (single resume file) ────────────
export const uploadResume = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
}).single("resume"); // field name = "resume"

// ─── Error wrapper (use in route) ────────────────────────────
export const handleResumeUpload = (req, res, next) => {
  uploadResume(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: `Resume file must be under ${MAX_SIZE_MB}MB`,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.field || "File upload error",
      });
    }

    return res.status(400).json({ success: false, message: err.message });
  });
};
