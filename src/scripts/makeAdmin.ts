import "dotenv/config";
import { connectDB } from "../config/db.js";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run make-admin -- <email>");
    process.exit(1);
  }

  const db = await connectDB();
  const result = await db
    .collection("user")
    .updateOne({ email }, { $set: { role: "admin", isBlocked: false } });

  if (result.matchedCount === 0) {
    console.error("No user found with that email. Sign up first, then run this.");
    process.exit(1);
  }
  console.log(`${email} is now an admin`);
  process.exit(0);
}

main();