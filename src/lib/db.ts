import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { type Message, messages } from "./schema";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");

// This riff swapped in a different prototype (a campus-wide room finder)
// onto a volume that may already hold an earlier prototype's tables — a
// Library room board whose `bookings` table used a different shape
// (integer `room_id` FK, no `building_id`) and its own now-irrelevant
// `rooms` table. A plain `migrate()` would try to CREATE TABLE `bookings`
// against a table that already exists with the wrong columns and crash the
// app at boot. Detect that one-time shape mismatch and drop the stale
// tables first — this prototype owns none of that data, so nothing here is
// worth preserving across the swap.
const bookingsCols = client
  .prepare(`SELECT name FROM pragma_table_info('bookings')`)
  .all() as { name: string }[];
const isPriorPrototypesBookings =
  bookingsCols.length > 0 && !bookingsCols.some((c) => c.name === "building_id");
if (isPriorPrototypesBookings) {
  client.exec("DROP TABLE IF EXISTS bookings; DROP TABLE IF EXISTS rooms;");
}

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

export type { Message };

export function listMessages(): Message[] {
  return db.select().from(messages).orderBy(desc(messages.id)).limit(50).all();
}

export function addMessage(body: string): Message {
  return db.insert(messages).values({ body }).returning().get();
}
