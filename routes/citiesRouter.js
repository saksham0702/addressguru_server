import express from "express";
import { getCities, addCities, deleteCity, updateCity } from "../controller/cities.Controller.js";
const router = express.Router();

router.get("/", function (req, res, next) {
  return res.send(`<!DOCTYPE html><html><head><title>Welcome to Elevate_U Backend</title></head><body style="display: flex; align-items: center; justify-content: center;">
    <h1>Welcome to AddressGuru UAE Backend Cities Router</h1>
  </body>
</html>`);
});

router.route("/get-cities").get(getCities);
router.route("/add-cities").post(addCities);
router.route("/delete-city/:id").delete(deleteCity);
router.route("/update-city/:id").put(updateCity);

export default router;
