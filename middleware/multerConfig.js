// ─── middleware/multerConfig.js ───────────────────────────────────────────────
import multer from "multer";
import fs from "fs";
import path from "path";

// ─── Helper: build upload directory path ─────────────────────────────────────
// Structure: uploads/<type>/<year>/<month>/<day>/<slug>/<fieldname>/
const getUploadPath = (type, slug) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleString("default", { month: "long" }); // e.g. "March"
  const day = String(now.getDate()).padStart(2, "0");

  return path.join(
    "uploads",
    type, // e.g. "business-listings"
    `${year}`,
    `${month}`,
    `${day}`,
    slug, // e.g. "al-noor-medical-center-1711234567890"
    // fieldname appended in destination callback: "logo" or "images"
  );
};

// ─── Dynamic storage configuration ───────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log("file", file);
    console.log("req.body", req.body);
    console.log("req.params", req.params);
    console.log("req.files", req.files);
    console.log("req._uploadFolder", req._uploadFolder);
    const type = req._uploadFolder || req.body.folder;
    if (!type) return cb(new Error("Upload folder type is required"), null);

    const slug = req.params.slug || req._slug || req.body.slug || "pending";

    // Final path: .../slug/logo/ or .../slug/images/
    const uploadPath = path.join(getUploadPath(type, slug), file.fieldname);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    // e.g. logo-1711234567890-123456789.jpg
    const fileName = `${file.fieldname}-${uniqueSuffix}${ext}`;
    cb(null, fileName);
  },
});

const ALLOWED_DOCUMENT_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

// ─── Multer instance ──────────────────────────────────────────────────────────
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB per file
    fieldSize: 50 * 1024 * 1024, // 50 MB text fields (e.g. rich text blog content)
  },
  fileFilter: function (req, file, cb) {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/") ||
      file.mimetype.startsWith("audio/") ||
      ALLOWED_DOCUMENT_MIMES.includes(file.mimetype)
    ) {
      return cb(null, true);
    }

    return cb(
      new Error(
        "File format not supported. Allowed formats: images, pdf, doc, xls, ppt, video, audio."
      ),
      false
    );
  },
});

export default upload;
