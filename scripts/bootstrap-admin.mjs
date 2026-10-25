import "dotenv/config";
import { randomUUID, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export async function bootstrapAdmin(connectionUrl, { name, email, password }) {
  if (
    !name?.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? "") ||
    password?.length < 8 ||
    password?.length > 128
  )
    throw new Error("Isi nama, email valid, dan password 8-128 karakter.");
  const hash = await hashPassword(password);
  const client = postgres(connectionUrl, { max: 1, connect_timeout: 5 });
  try {
    return await client.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(81448001)`;
      const [existing] =
        await tx`select count(*)::int as count from committee_admins`;
      if (existing.count)
        throw new Error(
          "Bootstrap ditolak: akun panitia sudah tersedia. Tambahkan panitia melalui dashboard.",
        );
      const id = randomUUID();
      await tx`insert into "user" (id, name, email, updated_at) values (${id}, ${name.trim()}, ${email.trim().toLowerCase()}, now())`;
      await tx`insert into account (id, account_id, provider_id, user_id, password, updated_at) values (${randomUUID()}, ${id}, 'credential', ${id}, ${hash}, now())`;
      await tx`insert into committee_admins (user_id) values (${id})`;
      await tx`insert into audit_logs (actor_id, action, entity_type, entity_id, metadata) values (${id}, 'Admin pertama dibuat', 'committee_admin', ${id}, ${tx.json({ category: "Pengaturan", detail: `${name.trim()} · bootstrap internal` })})`;
      return { id, email: email.trim().toLowerCase() };
    });
  } finally {
    await client.end();
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
    const name =
      process.env.QURBAN_BOOTSTRAP_NAME ||
      (await input.question("Nama admin: "));
    const email =
      process.env.QURBAN_BOOTSTRAP_EMAIL ||
      (await input.question("Email admin: "));
    const password =
      process.env.QURBAN_BOOTSTRAP_PASSWORD ||
      randomBytes(24).toString("base64url");
    const result = await bootstrapAdmin(process.env.DATABASE_URL, {
      name,
      email,
      password,
    });
    console.log(`Admin pertama siap: ${result.email}`);
    if (!process.env.QURBAN_BOOTSTRAP_PASSWORD)
      console.log(`Password acak (simpan sekarang): ${password}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    input.close();
  }
}
