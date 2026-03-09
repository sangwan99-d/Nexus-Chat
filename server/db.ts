import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureTablesExist(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "phone" text NOT NULL UNIQUE,
        "display_name" text NOT NULL,
        "password_hash" text NOT NULL,
        "avatar_url" text,
        "last_seen" timestamp DEFAULT now(),
        "is_online" boolean DEFAULT false,
        "is_ai_user" boolean DEFAULT false,
        "has_ai_access" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "from_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "to_user_id" varchar NOT NULL,
        "content" text NOT NULL,
        "type" text NOT NULL DEFAULT 'text',
        "metadata" json,
        "is_read" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ai_messages" (
        "id" serial PRIMARY KEY,
        "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("[db] Tables verified/created successfully");
  } catch (err) {
    console.error("[db] Failed to ensure tables exist:", err);
    throw err;
  } finally {
    client.release();
  }
}
