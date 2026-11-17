import "dotenv/config"; 
import app from "./app.js";
import { connectDB } from "./config/db.js";

const port = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});