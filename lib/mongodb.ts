import "server-only";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.",
  );
}

// In development, Next.js reloads modules on every change. Keeping the client
// on globalThis stops us from opening a new connection pool each time.
const globalForMongo = globalThis as unknown as { _mongoClient?: MongoClient };

// A small pool and short timeouts: the free Atlas tier allows a limited number of
// connections, and a request should fail quickly with an error rather than hang
// for 30 seconds when the database can't be reached.
export const client =
  globalForMongo._mongoClient ??
  new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS: 8_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForMongo._mongoClient = client;
}

export const db = client.db(process.env.MONGODB_DB ?? "doclens");
