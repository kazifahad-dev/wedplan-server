import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;
let connecting: Promise<Db> | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;
  if (!connecting) {
    client = new MongoClient(process.env.MONGODB_URI as string);
    connecting = client.connect().then(() => {
      db = client!.db(process.env.DB_NAME);
      return db;
    });
  }
  return connecting;
}

export function getDB(): Db {
  if (!db) throw new Error("আগে connectDB() চালাতে হবে");
  return db;
}