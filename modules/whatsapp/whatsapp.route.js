// modules/whatsapp/routes/whatsappRoutes.js
import { Router } from "express";
import * as whatsappController from "./whatsapp.controller.js";
import { whatsappUpload } from "./whatsapp.multer.js";
// import { requireAdmin } from "../../../middlewares/authMiddleware.js";
// ^ point this at your existing admin-auth middleware and uncomment router.use below.

const router = Router();

// router.use(requireAdmin); // recommended: lock the whole module behind admin auth

router.get("/status", whatsappController.getStatus);
router.get("/qr", whatsappController.getQr);
router.post("/connect", whatsappController.connect);
router.post("/disconnect", whatsappController.disconnect);

router.get("/chats", whatsappController.getChats);
router.get("/conversation", whatsappController.getConversation);
router.get("/chats/:chatId/messages", whatsappController.getChatMessages);

router.post("/send", whatsappController.sendMessage);
router.post(
  "/send-media",
  whatsappUpload.single("file"),
  whatsappController.sendMedia,
);

export default router;
