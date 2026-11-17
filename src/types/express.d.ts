export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "vendor" | "customer";
  isBlocked: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}