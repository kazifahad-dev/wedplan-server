import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import {
  createService,
  getMyServices,
  updateService,
  toggleAvailability,
  deleteService,
} from "../controllers/service.controller.js";

const router = Router();


router.use(verifyToken, requireRole("vendor"));

router.post("/", createService);
router.get("/mine", getMyServices);
router.patch("/:id/availability", toggleAvailability);
router.patch("/:id", updateService);
router.delete("/:id", deleteService);

export default router;