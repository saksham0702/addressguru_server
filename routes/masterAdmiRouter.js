import express from "express";
import {
  deleteUser,
  getAllUsers,
  getUserById,
  restoreUser,
  updateUser,
} from "../controller/user.Controller.js";
import impersonateUser from "../middleware/impersonateUser.js";
import {authenticate} from "../middleware/userAuth.js";
const router = express.Router();

router.get("/", function (req, res, next) {
  return res.send(`<!DOCTYPE html><html><head><title>Welcome to Elevate_U Backend</title></head><body style="display: flex; align-items: center; justify-content: center;">
    <h1>Welcome to AddressGuru UAE Backend MASTER Router</h1>
  </body>
</html>`);
});

router.route("/user-login/:userId").post(authenticate, impersonateUser);

router.route("/get-all-users").get(getAllUsers);
router.route("/:id").get(getUserById).put(updateUser).delete(deleteUser);
router.route("/restore/:id").patch(restoreUser);

export default router;
