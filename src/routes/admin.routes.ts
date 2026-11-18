import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import {
  getStats,
  getUsers,
  getUserById,
  setUserBlocked,
  getAllServices,
  setServiceStatus,
  deleteAnyService,
  getTransactions,
} from "../controllers/admin.controller.js";

const router = Router();


router.use(verifyToken, requireRole("admin"));

router.get("/stats", getStats);

router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/block", setUserBlocked);

router.get("/services", getAllServices);
router.patch("/services/:id/status", setServiceStatus);
router.delete("/services/:id", deleteAnyService);

router.get("/transactions", getTransactions);

export default router;