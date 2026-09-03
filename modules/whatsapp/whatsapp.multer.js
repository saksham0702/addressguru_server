// ─── modules/whatsapp/whatsapp.multer.js ─────────────────────────────────────────
import multer from "multer";
import fs from "fs";
import path from "path";

// ─── Helper: build upload directory path ─────────────────────────────────────
// Structure: uploads/whatsapp/<year>/<month>/<day>/<fieldname>/
const getUploadPath = (type = "whatsapp") => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleString("default", { month: "long" }); // e.g. "September"
  const day = String(now.getDate()).padStart(2, "0");

  return path.join("uploads", type, `${year}`, `${month}`, `${day}`);
};

// ─── Dynamic storage configuration ───────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const type = req._uploadFolder || req.body.folder || "whatsapp";
    const uploadPath = path.join(getUploadPath(type), file.fieldname || "media");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const fieldname = file.fieldname || "media";
    const fileName = `${fieldname}-${uniqueSuffix}${ext}`;
    cb(null, fileName);
  },
});

// ─── Multer instance ──────────────────────────────────────────────────────────
export const whatsappUpload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB per file
  fileFilter: function (req, file, cb) {
    cb(null, true);
  },
});

export default whatsappUpload;
