import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import {
  createBooking,
  getMyBookings,
  getVendorBookings,
  updateBookingStatus,
  cancelBooking,
} from "../controllers/booking.controller.js";

const router = Router();


router.use(verifyToken);


router.post("/", requireRole("customer", "vendor"), createBooking);


router.get("/mine", requireRole("customer"), getMyBookings);
router.patch("/:id/cancel", requireRole("customer"), cancelBooking);


router.get("/vendor", requireRole("vendor"), getVendorBookings);
router.patch("/:id/status", requireRole("vendor"), updateBookingStatus);

export default router;