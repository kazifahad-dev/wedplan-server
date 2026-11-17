import { z } from "zod";

export const CATEGORIES = [
  "Photography & Videography",
  "Wedding Venues",
  "Decoration & Florist",
  "Catering Services",
  "Makeup & Styling",
  "Wedding Fashion",
] as const;

export const serviceSchema = z.object({
  serviceName: z.string().trim().min(3, "Service name must be at least 3 characters"),
  category: z.enum(CATEGORIES, { message: "Invalid category" }),
  description: z.string().trim().min(10, "Description must be at least 10 characters"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  location: z.string().trim().min(2, "Location is required"),
  images: z.array(z.string().url()).min(1, "At least one image is required").max(5),
});


export const serviceUpdateSchema = serviceSchema.partial();