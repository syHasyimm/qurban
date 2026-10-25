import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const image =
  process.env.QURBAN_DOCKER_TEST_IMAGE || "qurban:startup-migrations-test";
const prefix = `qurban-startup-${randomBytes(6).toString("hex")}`;
const containers = [];
const network = `${prefix}-network`;
const database = `${prefix}-postgres`;
const app = `${prefix}-app`;
const origin = "http://localhost:3005";
const environment = {
  ...process.env,
  POSTGRES_USER: "qurban_test",
  POSTGRES_DB: "qurban_startup_test",
  POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
  BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
  BETTER_AUTH_URL: origin,
  NEXT_PUBLIC_APP_URL: origin,
};
environment.DATABASE_URL = `postgresql://${environment.POSTGRES_USER}:${environment.POSTGRES_PASSWORD}@${database}:5432/${environment.POSTGRES_DB}`;
const envArgs = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
].flatMap((key) => ["-e", key]);
let fixture;
let networkCreated = false;

function docker(args, { env = environment, allowFailure = false } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn("docker", args, {
      env,
      windowsHide: true,
      timeout: 60000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0 && !allowFailure)
        reject(new Error(`Docker ${args[0]} failed: ${stderr}`));
      else
        resolveResult({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}
async function query(sql, name = environment.POSTGRES_DB) {
  return (
    await docker([
      "exec",
      database,
      "psql",
      "-U",
      environment.POSTGRES_USER,
      "-d",
      name,
      "-Atc",
      sql,
    ])
  ).stdout;
}
async function waitFor(check, message) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(message);
}
async function waitForApp() {
  await waitFor(async () => {
    try {
      return (
        (
          await fetch(`${origin}/api/public/qurban`, {
            signal: AbortSignal.timeout(1500),
          })
        ).status === 200
      );
    } catch {
      return false;
    }
  }, "Application did not start after migrations.");
}
function adminThroughTerminal(script, answers, passwordPattern) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(
      "docker",
      ["exec", "-i", app, "node", `/app/scripts/${script}.mjs`],
      { windowsHide: true, timeout: 20000 },
    );
    let output = "";
    let stderr = "";
    let answerIndex = 0;
    child.stdout.on("data", (chunk) => {
      output += chunk;
      while (
        answerIndex < answers.length &&
        output.includes(answers[answerIndex][0])
      ) {
        child.stdin.write(`${answers[answerIndex][1]}\n`);
        answerIndex++;
        if (answerIndex === answers.length) child.stdin.end();
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolveResult({
        code,
        password: output.match(passwordPattern)?.[1],
        stderr,
      });
    });
  });
}
function resetThroughTerminal(email = "docker@example.test") {
  return adminThroughTerminal(
    "reset-admin",
    [["Email admin:", email]],
    /Password baru \(simpan sekarang\): (\S+)/,
  );
}

try {
  await docker(["image", "inspect", image]);
  await docker(["network", "create", network]);
  networkCreated = true;
  containers.push(database);
  await docker([
    "run",
    "-d",
    "--name",
    database,
    "--network",
    network,
    "-e",
    "POSTGRES_USER",
    "-e",
    "POSTGRES_PASSWORD",
    "-e",
    "POSTGRES_DB",
    "postgres:17-alpine",
  ]);
  await waitFor(
    async () =>
      (
        await docker(
          [
            "exec",
            database,
            "pg_isready",
            "-U",
            environment.POSTGRES_USER,
            "-d",
            environment.POSTGRES_DB,
          ],
          { allowFailure: true },
        )
      ).code === 0,
    "Isolated PostgreSQL did not start.",
  );

  containers.push(app);
  await docker([
    "run",
    "-d",
    "--name",
    app,
    "--network",
    network,
    "-p",
    "127.0.0.1:3005:3000",
    ...envArgs,
    image,
  ]);
  await waitForApp();
  assert.equal((await docker(["exec", app, "id", "-u"])).stdout, "1000");
  assert.equal((await fetch(`${origin}/api/account`)).status, 401);
  assert.equal((await fetch(`${origin}/login`)).status, 200);
  const journal = JSON.parse(
    await readFile(
      new URL("../drizzle/meta/_journal.json", import.meta.url),
      "utf8",
    ),
  );
  const historyQuery = "select count(*) from drizzle.__drizzle_migrations";
  assert.equal(await query(historyQuery), String(journal.entries.length));
  console.log(
    "PASS: empty database migrates before the non-root application starts.",
  );

  const bootstrapped = await adminThroughTerminal(
    "bootstrap-admin",
    [
      ["Nama admin:", "Panitia Docker"],
      ["Email admin:", "docker@example.test"],
    ],
    /Password acak \(simpan sekarang\): (\S+)/,
  );
  assert.equal(bootstrapped.code, 0, "Interactive admin bootstrap failed.");
  assert.ok(bootstrapped.password);
  const password = bootstrapped.password;
  const signIn = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify({ email: "docker@example.test", password }),
  });
  assert.equal(signIn.status, 200, "Bootstrapped admin could not sign in.");
  const repeated = await docker(
    [
      "exec",
      "-e",
      "QURBAN_BOOTSTRAP_NAME=Panitia Kedua",
      "-e",
      "QURBAN_BOOTSTRAP_EMAIL=second@example.test",
      app,
      "node",
      "/app/scripts/bootstrap-admin.mjs",
    ],
    { allowFailure: true },
  );
  assert.equal(repeated.code, 1);
  assert.match(repeated.stderr, /Bootstrap ditolak/);

  const cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  assert.equal(
    (await fetch(`${origin}/api/account`, { headers: { cookie } })).status,
    200,
  );
  const originalCredential = await query(
    "select id || ':' || user_id || ':' || password from account where provider_id = 'credential'",
  );
  const originalAdmin = await query("select user_id from committee_admins");
  const missing = await resetThroughTerminal("missing@example.test");
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /tidak ditemukan/);
  assert.equal(missing.password, undefined);

  await query("update committee_admins set is_active = false");
  const inactive = await resetThroughTerminal();
  assert.equal(inactive.code, 1);
  assert.match(inactive.stderr, /tidak aktif/);
  assert.equal(inactive.password, undefined);
  await query("update committee_admins set is_active = true");

  // A failed audit insert must roll back both the new hash and session deletion.
  await query(`create function docker_reject_reset() returns trigger language plpgsql as $$
    begin raise exception 'synthetic reset audit failure'; end; $$;
    create trigger docker_reject_reset before insert on audit_logs
    for each row when (new.action = 'Password admin direset') execute function docker_reject_reset()`);
  const rejected = await resetThroughTerminal();
  assert.equal(rejected.code, 1);
  assert.match(rejected.stderr, /synthetic reset audit failure/);
  assert.equal(rejected.password, undefined);
  assert.equal(
    await query(
      "select id || ':' || user_id || ':' || password from account where provider_id = 'credential'",
    ),
    originalCredential,
  );
  assert.equal(
    (await fetch(`${origin}/api/account`, { headers: { cookie } })).status,
    200,
  );
  await query(
    "drop trigger docker_reject_reset on audit_logs; drop function docker_reject_reset()",
  );

  const reset = await resetThroughTerminal("  DOCKER@EXAMPLE.TEST  ");
  assert.equal(reset.code, 0, "Interactive admin password reset failed.");
  assert.ok(reset.password);
  assert.equal(
    await query("select user_id from committee_admins"),
    originalAdmin,
  );
  assert.equal(await query("select count(*) from session"), "0");
  assert.equal(
    (await fetch(`${origin}/api/account`, { headers: { cookie } })).status,
    401,
  );
  assert.equal(
    await query(
      "select count(*) from audit_logs where action = 'Password admin direset'",
    ),
    "1",
  );
  for (const [candidate, expected] of [
    [password, 401],
    [reset.password, 200],
  ]) {
    const response = await fetch(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify({
        email: "docker@example.test",
        password: candidate,
      }),
    });
    assert.equal(
      response.status,
      expected,
      "Password reset authentication result was incorrect.",
    );
  }
  console.log(
    "PASS: terminal password reset revokes sessions, preserves the admin, rejects inactive/missing accounts, and rolls back on failure.",
  );

  await docker(["restart", app]);
  await waitForApp();
  await docker([
    "exec",
    "--workdir",
    "/",
    app,
    "node",
    "/app/scripts/migrate.mjs",
  ]);
  assert.equal(await query(historyQuery), String(journal.entries.length));
  assert.equal(await query("select count(*) from committee_admins"), "1");
  assert.equal(await query('select count(*) from "user"'), "1");
  console.log(
    "PASS: terminal bootstrap, admin login, and restart preserve data and migration history.",
  );

  await query("create database qurban_concurrent_test");
  const concurrentEnv = {
    ...environment,
    DATABASE_URL: environment.DATABASE_URL.replace(
      /qurban_startup_test$/,
      "qurban_concurrent_test",
    ),
  };
  await Promise.all(
    [0, 1].map(async (index) => {
      const name = `${prefix}-migration-${index}`;
      containers.push(name);
      await docker(
        [
          "run",
          "--rm",
          "--name",
          name,
          "--network",
          network,
          "-e",
          "DATABASE_URL",
          image,
          "node",
          "/app/scripts/migrate.mjs",
        ],
        { env: concurrentEnv },
      );
    }),
  );
  assert.equal(
    await query(historyQuery, "qurban_concurrent_test"),
    String(journal.entries.length),
  );
  console.log(
    "PASS: concurrent migration containers serialize without duplicate migrations.",
  );

  fixture = await mkdtemp(join(tmpdir(), "qurban-startup-test-"));
  await cp(new URL("../drizzle/", import.meta.url), fixture, {
    recursive: true,
  });
  const last = journal.entries.at(-1);
  journal.entries.push({
    ...last,
    idx: journal.entries.length,
    when: last.when + 1,
    tag: "9999_docker_failure",
  });
  await writeFile(
    join(fixture, "meta", "_journal.json"),
    JSON.stringify(journal),
  );
  await writeFile(
    join(fixture, "9999_docker_failure.sql"),
    "create table docker_startup_partial (id integer);\n--> statement-breakpoint\nselect 1 / 0;\n",
  );
  const failed = `${prefix}-failure`;
  containers.push(failed);
  await docker([
    "run",
    "-d",
    "--name",
    failed,
    "--network",
    network,
    "--mount",
    `type=bind,source=${fixture},target=/app/drizzle,readonly`,
    ...envArgs,
    image,
  ]);
  assert.equal((await docker(["wait", failed])).stdout, "1");
  const logs = await docker(["logs", failed]);
  assert.match(logs.stdout + logs.stderr, /Migrasi gagal/);
  assert.doesNotMatch(logs.stdout + logs.stderr, /Ready in/);
  assert.equal(await query(historyQuery), String(journal.entries.length - 1));
  assert.equal(
    await query("select to_regclass('public.docker_startup_partial') is null"),
    "t",
  );
  console.log("PASS: failed SQL rolls back and prevents application startup.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const name of containers.reverse()) {
    if (!name.startsWith(`${prefix}-`))
      throw new Error("Refusing unrelated container cleanup.");
    await docker(["rm", "-f", name], { allowFailure: true });
  }
  if (networkCreated) await docker(["network", "rm", network]);
  if (fixture) {
    if (
      dirname(resolve(fixture)) !== resolve(tmpdir()) ||
      !basename(fixture).startsWith("qurban-startup-test-")
    )
      throw new Error("Refusing unrelated directory cleanup.");
    await rm(fixture, { recursive: true, force: true });
  }
  console.log(
    "Isolated Docker test resources removed; existing containers and databases unchanged.",
  );
}
