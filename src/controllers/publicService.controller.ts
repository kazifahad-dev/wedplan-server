import { Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const services = () => getDB().collection("services");


const PUBLIC_FILTER = { status: "approved", isActive: true };


function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


const VENDOR_LOOKUP = [
  {
    $addFields: { vendorObjectId: { $toObjectId: "$vendorId" } },
  },
  {
   
    $lookup: {
      from: "user",
      localField: "vendorObjectId",
      foreignField: "_id",
      pipeline: [
        {
          $project: {
            _id: 0,
            name: 1,
            businessName: 1,
            image: 1,
            subscriptionPlan: 1,
          },
        },
      ],
      as: "vendor",
    },
  },
  { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      "vendor.isPremium": { $eq: ["$vendor.subscriptionPlan", "premium"] },
    },
  },
  { $project: { vendorObjectId: 0, "vendor.subscriptionPlan": 0 } },
];


export async function getPublicServices(req: Request, res: Response) {
  const { search, category, location, sort } = req.query;

  const filter: Record<string, unknown> = { ...PUBLIC_FILTER };

  if (typeof search === "string" && search.trim()) {
    filter.serviceName = { $regex: escapeRegex(search.trim()), $options: "i" };
  }
  if (typeof category === "string" && category.trim()) {
    filter.category = category;
  }
  if (typeof location === "string" && location.trim()) {
    filter.location = { $regex: escapeRegex(location.trim()), $options: "i" };
  }

  
  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === "price_asc") sortOption = { price: 1 };
  if (sort === "price_desc") sortOption = { price: -1 };

  const page = Math.max(parseInt(String(req.query.page)) || 1, 1);
  const limit = Math.min(parseInt(String(req.query.limit)) || 12, 50);

  const [items, total] = await Promise.all([
    services()
      .aggregate([
        { $match: filter },
        { $sort: sortOption },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        ...VENDOR_LOOKUP,
      ])
      .toArray(),
    services().countDocuments(filter),
  ]);

  res.json({
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}


export async function getFeaturedServices(_req: Request, res: Response) {
  const items = await services()
    .aggregate([
      { $match: PUBLIC_FILTER },
      { $sort: { createdAt: -1 } },
      { $limit: 6 },
      ...VENDOR_LOOKUP,
    ])
    .toArray();
  res.json(items);
}


export async function getCategoryCounts(_req: Request, res: Response) {
  const counts = await services()
    .aggregate([
      { $match: PUBLIC_FILTER },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ])
    .toArray();
  res.json(counts.map((c) => ({ category: c._id, count: c.count })));
}



export async function getServiceById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const id = String(req.params.id);

  
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return next();
  }

  const [service] = await services()
    .aggregate([
      { $match: { _id: new ObjectId(id), ...PUBLIC_FILTER } },
      ...VENDOR_LOOKUP,
    ])
    .toArray();

  if (!service) {
    return res.status(404).json({ message: "Service not found or unavailable" });
  }
  res.json(service);
}