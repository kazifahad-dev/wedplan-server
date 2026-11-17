import { MongoClient, Db } from "mongodb";

let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db; 

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI .env ফাইলে নেই");

  const client = new MongoClient(uri);
  await client.connect();
  db = client.db(); 
  console.log("MongoDB connected");
  return db;
}

export function getDB(): Db {
  if (!db) throw new Error("আগে connectDB() চালাতে হবে");
  return db;
}