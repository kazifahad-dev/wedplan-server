import { MongoClient, Db } from "mongodb";

let db: Db | null = null;
let connecting: Promise<Db> | null = null;


export function connectDB(): Promise<Db> {
  if (db) return Promise.resolve(db);

  if (!connecting) {
    connecting = (async () => {
      const uri = process.env.MONGODB_URI;
      if (!uri) throw new Error("MONGODB_URI .env not in file");

      const client = new MongoClient(uri);
      await client.connect();
      db = client.db(); 
      console.log("MongoDB connected");
      return db;
    })().catch((err) => {
      connecting = null; 
      throw err;
    });
  }
  return connecting;
}

export function getDB(): Db {
  if (!db) throw new Error("First run connectDB()");
  return db;
}