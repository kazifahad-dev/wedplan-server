import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`),
);

export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: token missing" });
    }

    const token = header.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.BETTER_AUTH_URL,
    });

    const userId = payload.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: invalid token" });
    }

    const user = await getDB()
      .collection("user")
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: user not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account is blocked" });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isBlocked: false,
    };

    next();
  } catch {
    return res
      .status(401)
      .json({ message: "Unauthorized: invalid or expired token" });
  }
}

export function requireRole(...roles: Array<"admin" | "vendor" | "customer">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: access denied" });
    }
    next();
  };
}
