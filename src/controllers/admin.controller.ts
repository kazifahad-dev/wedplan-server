import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { escapeRegex } from "../utils/escapeRegex.js";

const users = () => getDB().collection("user");
const services = () => getDB().collection("services");
const transactions = () => getDB().collection("transactions");
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function getPaging(req: Request) {
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1);
  const limit = Math.min(parseInt(String(req.query.limit)) || 10, 50);
  return { page, limit, skip: (page - 1) * limit };
}


export async function getStats(_req: Request, res: Response) {
  const [totalUsers, totalVendors, totalCustomers, totalServices, pendingServices, totalTransactions] =
    await Promise.all([
      users().countDocuments(),
      users().countDocuments({ role: "vendor" }),
      users().countDocuments({ role: "customer" }),
      services().countDocuments(),
      services().countDocuments({ status: "pending" }),
      transactions().countDocuments(),
    ]);

  res.json({
    totalUsers,
    totalVendors,
    totalCustomers,
    totalServices,
    pendingServices,
    totalTransactions,
  });
}


export async function getUsers(req: Request, res: Response) {
  const { search, role } = req.query;
  const filter: Record<string, unknown> = {};

  if (typeof role === "string" && ["admin", "vendor", "customer"].includes(role)) {
    filter.role = role;
  }
  if (typeof search === "string" && search.trim()) {
    const regex = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ name: regex }, { email: regex }]; 
  }

  const { page, limit, skip } = getPaging(req);
  const [items, total] = await Promise.all([
    users()
      .find(filter)
      .project({
        name: 1, email: 1, image: 1, role: 1, isBlocked: 1,
        businessName: 1, subscriptionPlan: 1, subscriptionExpiresAt: 1, createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    users().countDocuments(filter),
  ]);

  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
}


export async function getUserById(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!OBJECT_ID.test(id)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const user = await users().findOne(
    { _id: new ObjectId(id) },
    {
      projection: {
        name: 1, email: 1, image: 1, role: 1, isBlocked: 1,
        businessName: 1, subscriptionPlan: 1, subscriptionExpiresAt: 1, createdAt: 1,
      },
    }
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
}


export async function setUserBlocked(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!OBJECT_ID.test(id)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  if (typeof req.body.isBlocked !== "boolean") {
    return res.status(400).json({ message: "isBlocked must be true or false" });
  }
  if (id === req.user!.id) {
    return res.status(400).json({ message: "You cannot block yourself" });
  }

  const target = await users().findOne({ _id: new ObjectId(id) });
  if (!target) return res.status(404).json({ message: "User not found" });
  if (target.role === "admin") {
    return res.status(403).json({ message: "Admin accounts cannot be blocked" });
  }

  await users().updateOne(
    { _id: new ObjectId(id) },
    { $set: { isBlocked: req.body.isBlocked } }
  );
  res.json({ message: req.body.isBlocked ? "User blocked" : "User unblocked" });
}


export async function getAllServices(req: Request, res: Response) {
  const { search, status, category } = req.query;
  const filter: Record<string, unknown> = {};

  if (typeof status === "string" && ["pending", "approved", "rejected"].includes(status)) {
    filter.status = status;
  }
  if (typeof category === "string" && category.trim()) {
    filter.category = category;
  }
  if (typeof search === "string" && search.trim()) {
    filter.serviceName = { $regex: escapeRegex(search.trim()), $options: "i" };
  }

  const { page, limit, skip } = getPaging(req);
  const [items, total] = await Promise.all([
    services()
      .aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $addFields: { vendorObjId: { $toObjectId: "$vendorId" } } },
        {
          $lookup: {
            from: "user",
            localField: "vendorObjId",
            foreignField: "_id",
            as: "vendor",
          },
        },
        { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            vendor: { name: "$vendor.name", email: "$vendor.email", businessName: "$vendor.businessName" },
          },
        },
        { $project: { vendorObjId: 0 } },
      ])
      .toArray(),
    services().countDocuments(filter),
  ]);

  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
}


export async function setServiceStatus(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!OBJECT_ID.test(id)) {
    return res.status(400).json({ message: "Invalid service id" });
  }
  const { status } = req.body;
  if (!["approved", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const result = await services().updateOne(
    { _id: new ObjectId(id) },
    { $set: { status } }
  );
  if (result.matchedCount === 0) {
    return res.status(404).json({ message: "Service not found" });
  }
  res.json({ message: `Service ${status}` });
}


export async function deleteAnyService(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!OBJECT_ID.test(id)) {
    return res.status(400).json({ message: "Invalid service id" });
  }

  const result = await services().deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Service not found" });
  }
  res.json({ message: "Service deleted" });
}


export async function getTransactions(req: Request, res: Response) {
  const { page, limit, skip } = getPaging(req);

  const [items, total] = await Promise.all([
    transactions()
      .aggregate([
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $addFields: { vendorObjId: { $toObjectId: "$vendorId" } } },
        {
          $lookup: {
            from: "user",
            localField: "vendorObjId",
            foreignField: "_id",
            as: "vendor",
          },
        },
        { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            plan: 1, amount: 1, currency: 1, status: 1, createdAt: 1,
            vendor: { name: "$vendor.name", email: "$vendor.email", businessName: "$vendor.businessName" },
          },
        },
      ])
      .toArray(),
    transactions().countDocuments(),
  ]);

  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
}