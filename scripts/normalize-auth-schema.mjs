import { readFileSync, writeFileSync } from "node:fs";

const schemaPath = new URL("../src/db/schema/auth.ts", import.meta.url);
const generated = readFileSync(schemaPath, "utf8");
// Better Auth generates timestamp columns without a time zone by default.
// Keep every auth instant unambiguous across application/database time zones.
const normalized = generated.replace(
  /timestamp\("([^"]+)"\)/g,
  'timestamp("$1", { withTimezone: true })',
);
writeFileSync(schemaPath, normalized);
console.log("Auth timestamps normalized to PostgreSQL timestamptz.");
