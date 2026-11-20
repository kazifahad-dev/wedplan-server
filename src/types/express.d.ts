import "express-serve-static-core";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "vendor" | "customer";
  isBlocked: boolean;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}