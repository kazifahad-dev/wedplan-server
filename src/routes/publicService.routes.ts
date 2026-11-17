import { Router } from "express";
import {
  getPublicServices,
  getFeaturedServices,
  getCategoryCounts,
  getServiceById,
} from "../controllers/publicService.controller.js";

const router = Router();

router.get("/", getPublicServices);
router.get("/featured", getFeaturedServices);
router.get("/categories", getCategoryCounts);
router.get("/:id", getServiceById);
router.get("/:id", getServiceById);

export default router;