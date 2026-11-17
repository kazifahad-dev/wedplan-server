import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { bookingSchema, bookingStatusSchema } from "../validators/booking.js";

const bookings = () => getDB().collection("bookings");
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;


export async function createBooking(req: Request, res: Response) {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  const { serviceId, eventDate, eventLocation, message } = parsed.data;
  const customerId = req.user!.id;

  
  const service = await getDB()
    .collection("services")
    .findOne({ _id: new ObjectId(serviceId), status: "approved", isActive: true });

  if (!service) {
    return res.status(404).json({ message: "Service not found or unavailable" });
  }


  if (service.vendorId === customerId) {
    return res.status(403).json({ message: "You cannot book your own service" });
  }

  
  const duplicate = await bookings().findOne({
    serviceId,
    customerId,
    eventDate: new Date(eventDate),
    status: { $in: ["pending", "accepted"] },
  });
  if (duplicate) {
    return res.status(409).json({
      message: "You already have an active request for this service on this date",
    });
  }

  const result = await bookings().insertOne({
    serviceId,
    vendorId: service.vendorId, 
    customerId,                 
    eventDate: new Date(eventDate),
    eventLocation,
    message: message ?? "",
    status: "pending",
    createdAt: new Date(),
  });

  res.status(201).json({ message: "Booking request sent", id: result.insertedId });
}


export async function getMyBookings(req: Request, res: Response) {
  const list = await bookings()
    .aggregate([
      { $match: { customerId: req.user!.id } },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          serviceObjId: { $toObjectId: "$serviceId" },
          vendorObjId: { $toObjectId: "$vendorId" },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "serviceObjId",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
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
          eventDate: 1,
          eventLocation: 1,
          message: 1,
          status: 1,
          createdAt: 1,
          service: {
            _id: "$service._id",
            serviceName: "$service.serviceName",
            price: "$service.price",
            image: { $arrayElemAt: ["$service.images", 0] },
          },
          vendor: {
            name: "$vendor.name",
            businessName: "$vendor.businessName",
            image: "$vendor.image",
          },
        },
      },
    ])
    .toArray();

  res.json(list);
}


export async function getVendorBookings(req: Request, res: Response) {
  const list = await bookings()
    .aggregate([
      { $match: { vendorId: req.user!.id } },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          serviceObjId: { $toObjectId: "$serviceId" },
          customerObjId: { $toObjectId: "$customerId" },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "serviceObjId",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "user",
          localField: "customerObjId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          eventDate: 1,
          eventLocation: 1,
          message: 1,
          status: 1,
          createdAt: 1,
          service: {
            _id: "$service._id",
            serviceName: "$service.serviceName",
          },
          customer: {
            name: "$customer.name",
            email: "$customer.email",
            image: "$customer.image",
          },
        },
      },
    ])
    .toArray();

  res.json(list);
}


export async function updateBookingStatus(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!OBJECT_ID.test(id)) {
    return res.status(400).json({ message: "Invalid booking id" });
  }

  const parsed = bookingStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  
  const result = await bookings().updateOne(
    { _id: new ObjectId(id), vendorId: req.user!.id, status: "pending" },
    { $set: { status: parsed.data.status } }
  );

  if (result.matchedCount === 0) {
    return explainFailure(res, id, { vendorId: req.user!.id });
  }
  res.json({ message: `Booking ${parsed.data.status}` });
}


export async function cancelBooking(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!OBJECT_ID.test(id)) {
    return res.status(400).json({ message: "Invalid booking id" });
  }

  const result = await bookings().updateOne(
    { _id: new ObjectId(id), customerId: req.user!.id, status: "pending" },
    { $set: { status: "cancelled" } }
  );

  if (result.matchedCount === 0) {
    return explainFailure(res, id, { customerId: req.user!.id });
  }
  res.json({ message: "Booking cancelled" });
}


async function explainFailure(
  res: Response,
  id: string,
  owner: { vendorId?: string; customerId?: string }
) {
  const booking = await bookings().findOne({ _id: new ObjectId(id), ...owner });
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }
  return res.status(409).json({
    message: `This booking is already ${booking.status} and cannot be changed`,
  });
}