import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function migrateDatabase(
  connectionUrl,
  migrationsFolder = fileURLToPath(new URL("../drizzle/", import.meta.url)),
) {
  try {
    const parsed = new URL(connectionUrl);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol))
      throw new Error();
  } catch {
    throw new Error("Isi DATABASE_URL dengan URL PostgreSQL yang valid.");
  }
  // A single persistent session keeps the advisory lock through Drizzle's
  // history-table setup and migration transaction. Closing it releases the lock.
  const client = postgres(connectionUrl, {
    max: 1,
    max_lifetime: 0,
    connect_timeout: 10,
    connection: {
      application_name: "qurban-migrations",
      lock_timeout: "60s",
      statement_timeout: "120s",
    },
    onnotice: () => {},
  });
  try {
    await client`select pg_advisory_lock(81448002)`;
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log("[migrate] Memeriksa migrasi database...");
  try {
    await migrateDatabase(process.env.DATABASE_URL);
    console.log("[migrate] Database siap. Seluruh migrasi sudah diterapkan.");
  } catch (error) {
    console.error("[migrate] Migrasi gagal. Aplikasi belum dijalankan.");
    console.error(error.cause?.message ?? error.message);
    process.exitCode = 1;
  }
}
