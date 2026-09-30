import { existsSync, mkdirSync, rmSync } from "node:fs";
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

// This riff swapped in a different prototype (a campus-wide room finder)
// onto a volume that may already hold an earlier prototype's tables — a
// Library room board whose `bookings` table used a different shape
// (integer `room_id` FK, no `building_id`) and its own now-irrelevant
// `rooms` table. Opening that file as-is and issuing DDL against it (an
// earlier version of this guard) still crashed in production even though it
// reproduced fine locally — the WAL/SHM sidecar files from whatever state
// the old app process left them in are also on this same path, and this
// prototype has no way to know that state is safe to build on. Deleting the
// database file and its sidecars outright, before ever opening a
// connection, is the only version of this guard that starts the new schema
// from a state this code actually created itself. This prototype owns none
// of that old data, so nothing here is worth preserving across the swap.
if (existsSync(path)) {
  const probe = new Database(path, { readonly: true });
  const bookingsCols = probe.prepare(`SELECT name FROM pragma_table_info('bookings')`).all() as {
    name: string;
  }[];
  probe.close();
  // A file this app's own migrations built always has bookings.building_id.
  // Anything else — the old shape, or no bookings table at all (what the
  // first version of this guard left behind: it dropped the table, then
  // migrate() skipped recreating it because the old app's journal entries
  // carry later timestamps than this app's migrations) — gets wiped.
  const isPriorPrototypesVolume = !bookingsCols.some((c) => c.name === "building_id");
  if (isPriorPrototypesVolume) {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(`${path}${suffix}`, { force: true });
  }
}

const client = new Database(path);
client.pragma("journal_mode = WAL");

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
