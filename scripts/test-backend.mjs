import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { bootstrapAdmin } from "./bootstrap-admin.mjs";

const require = createRequire(import.meta.url);
const name = `qurban_e2e_${randomBytes(10).toString("hex")}`;
const originalUrl = process.env.DATABASE_URL;
if (!originalUrl) throw new Error("DATABASE_URL is required.");
const testUrl = new URL(originalUrl);
testUrl.pathname = `/${name}`;
const admin = postgres(originalUrl, { max: 1, connect_timeout: 5 });
let created = false;
let server;
let migrationClient;
const password = randomBytes(24).toString("base64url");
const testEnv = {
  ...process.env,
  DATABASE_URL: testUrl.href,
  BETTER_AUTH_URL: "http://localhost:3002",
  NEXT_PUBLIC_APP_URL: "http://localhost:3002",
  QURBAN_TEST_RUN: "1",
  QURBAN_BACKEND_TEST_DB: name,
  QURBAN_BACKEND_TEST_PASSWORD: password,
};
function run(script, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      stdio: "inherit",
      env,
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Process failed (${code}).`)),
    );
  });
}
try {
  const [found] =
    await admin`select exists(select 1 from pg_database where datname = ${name}) as present`;
  if (found.present || !/^qurban_e2e_[a-f0-9]{20}$/.test(name))
    throw new Error("Invalid isolated test database.");
  await admin.unsafe(`create database "${name}"`);
  created = true;
  migrationClient = postgres(testUrl.href, { max: 1 });
  await migrate(drizzle(migrationClient), { migrationsFolder: "drizzle" });
  await migrationClient.end();
  migrationClient = undefined;
  await bootstrapAdmin(testUrl.href, {
    name: "Admin Pengujian",
    email: "backend@example.test",
    password,
  });
  try {
    await bootstrapAdmin(testUrl.href, {
      name: "Bootstrap kedua",
      email: "another@example.test",
      password,
    });
    throw new Error("Repeated bootstrap was allowed.");
  } catch (error) {
    if (!error.message.includes("Bootstrap ditolak")) throw error;
  }
  console.log(
    "Isolated database ready; repeated bootstrap correctly rejected.",
  );
  await run(require.resolve("next/dist/bin/next"), ["build"], testEnv);
  server = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "localhost",
      "--port",
      "3002",
    ],
    { env: testEnv, stdio: "inherit", windowsHide: true },
  );
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Test server stopped before readiness.");
    try {
      if ((await fetch("http://localhost:3002/api/public/qurban")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Test server did not become ready.");
  await run(
    require.resolve("@playwright/test/cli"),
    ["test", "--config=playwright.backend.config.ts", ...process.argv.slice(2)],
    testEnv,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    const stopped = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await stopped;
  }
  if (migrationClient) await migrationClient.end();
  if (
    created &&
    /^qurban_e2e_[a-f0-9]{20}$/.test(name) &&
    new URL(originalUrl).pathname !== `/${name}`
  ) {
    await admin.unsafe(`drop database "${name}" with (force)`);
    console.log("Isolated test database removed; primary data unchanged.");
  }
  await admin.end();
}
