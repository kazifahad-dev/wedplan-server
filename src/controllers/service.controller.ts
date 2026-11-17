import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { serviceSchema, serviceUpdateSchema } from "../validators/service.js";

const FREE_LIMIT = 3;
const services = () => getDB().collection("services");


async function canPublishMore(vendorId: string): Promise<boolean> {
  const vendor = await getDB()
    .collection("user")
    .findOne({ _id: new ObjectId(vendorId) });

  const isPremium =
    vendor?.subscriptionPlan === "premium" &&
    (!vendor.subscriptionExpiresAt ||
      new Date(vendor.subscriptionExpiresAt) > new Date());

  if (isPremium) return true; 

  const activeCount = await services().countDocuments({
    vendorId,
    isActive: true,
    status: { $ne: "rejected" },
  });
  return activeCount < FREE_LIMIT;
}


export async function createService(req: Request, res: Response) {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  const vendorId = req.user!.id;

  if (!(await canPublishMore(vendorId))) {
    return res.status(403).json({
      message: "Free plan allows maximum 3 active services. Upgrade to Premium.",
    });
  }

  const doc = {
    ...parsed.data,
    vendorId,           
    status: "pending",   
    isActive: true,
    createdAt: new Date(),
  };

  const result = await services().insertOne(doc);
  res.status(201).json({ message: "Service submitted for review", id: result.insertedId });
}


export async function getMyServices(req: Request, res: Response) {
  const list = await services()
    .find({ vendorId: req.user!.id })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(list);
}


export async function updateService(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid service id" });
  }

  const parsed = serviceUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  
  const result = await services().updateOne(
    { _id: new ObjectId(id), vendorId: req.user!.id },
    { $set: parsed.data }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ message: "Service not found" });
  }
  res.json({ message: "Service updated" });
}


export async function toggleAvailability(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid service id" });
  }
  if (typeof req.body.isActive !== "boolean") {
    return res.status(400).json({ message: "isActive must be true or false" });
  }

  
  if (req.body.isActive && !(await canPublishMore(req.user!.id))) {
    return res.status(403).json({
      message: "Free plan allows maximum 3 active services. Upgrade to Premium.",
    });
  }

  const result = await services().updateOne(
    { _id: new ObjectId(id), vendorId: req.user!.id },
    { $set: { isActive: req.body.isActive } }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ message: "Service not found" });
  }
  res.json({ message: "Availability updated" });
}


export async function deleteService(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid service id" });
  }

  const result = await services().deleteOne({
    _id: new ObjectId(id),
    vendorId: req.user!.id,
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Service not found" });
  }
  res.json({ message: "Service deleted" });
}