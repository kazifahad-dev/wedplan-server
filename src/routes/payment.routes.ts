import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import {
  createCheckoutSession,
  getPaymentStatus,
  getMySubscription,
} from "../controllers/payment.controller.js";

const router = Router();


router.use(verifyToken, requireRole("vendor"));

router.post("/create-checkout-session", createCheckoutSession);
router.get("/status", getPaymentStatus);
router.get("/my-subscription", getMySubscription);

export default router;