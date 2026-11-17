import express from "express";
import cors from "cors";
import { verifyToken, requireRole } from "./middleware/auth.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL, 
    credentials: true,
  })
);
app.use(express.json()); 

app.get("/", (_req, res) => {
  res.json({ message: "WedPlan server is running" });
});

app.get("/api/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/admin-test", verifyToken, requireRole("admin"), (_req, res) => {
  res.json({ message: "Welcome admin" });
});

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});


app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
);

export default app;