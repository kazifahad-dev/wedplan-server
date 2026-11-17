import { z } from "zod";

export const bookingSchema = z.object({
  serviceId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid service id"),
  
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Event date must be YYYY-MM-DD")
    .refine((d) => new Date(d) > new Date(), "Event date must be in the future"),
  eventLocation: z.string().trim().min(2, "Event location is required"),
  message: z.string().trim().max(500, "Message is too long").optional(),
});

export const bookingStatusSchema = z.object({
  status: z.enum(["accepted", "rejected"], {
    message: "Status must be accepted or rejected",
  }),
});