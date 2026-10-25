import "dotenv/config";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

export async function resetAdminPassword(connectionUrl, { email, password }) {
  try {
    const parsed = new URL(connectionUrl);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol))
      throw new Error();
  } catch {
    throw new Error("Isi DATABASE_URL dengan URL PostgreSQL yang valid.");
  }
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error("Isi email valid dan password 12-128 karakter.");

  const hash = await hashPassword(password);
  const client = postgres(connectionUrl, {
    max: 1,
    connect_timeout: 5,
    connection: {
      application_name: "qurban-admin-reset",
      lock_timeout: "5s",
      statement_timeout: "15s",
    },
  });
  try {
    return await client.begin(async (tx) => {
      // Serialize with bootstrap and the application's admin/password commands.
      await tx`select pg_advisory_xact_lock(81448001)`;
      const [admin] = await tx`
        select u.id, u.email, a.is_active
        from "user" u
        inner join committee_admins a on a.user_id = u.id
        where u.email = ${normalizedEmail}
        for update of a, u
      `;
      if (!admin)
        throw new Error("Admin dengan email tersebut tidak ditemukan.");
      if (!admin.is_active)
        throw new Error(
          "Akun panitia tidak aktif. Aktifkan melalui pengelolaan panitia terlebih dahulu.",
        );

      const credentials = await tx`
        select id from account
        where user_id = ${admin.id} and provider_id = 'credential' and account_id = ${admin.id}
        for update
      `;
      if (credentials.length !== 1)
        throw new Error("Data login admin tidak valid. Reset dibatalkan.");

      await tx`update account set password = ${hash}, updated_at = now() where id = ${credentials[0].id}`;
      await tx`delete from session where user_id = ${admin.id}`;
      await tx`insert into audit_logs (actor_id, action, entity_type, entity_id, metadata)
        values (${admin.id}, 'Password admin direset', 'committee_admin', ${admin.id},
          ${tx.json({ category: "Pengaturan", detail: "Reset melalui terminal aplikasi; seluruh sesi lama diakhiri." })})`;
      return { id: admin.id, email: admin.email };
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const email = await input.question("Email admin: ");
    const password = randomBytes(24).toString("base64url");
    const result = await resetAdminPassword(process.env.DATABASE_URL, {
      email,
      password,
    });
    console.log(`Password admin berhasil direset: ${result.email}`);
    console.log("Seluruh sesi lama sudah diakhiri.");
    console.log(`Password baru (simpan sekarang): ${password}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    input.close();
  }
}
