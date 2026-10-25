import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { hashPassword } from "better-auth/crypto";

const origin = "http://localhost:3002";
const testDatabase = process.env.QURBAN_BACKEND_TEST_DB;
if (
  !testDatabase ||
  !/^qurban_e2e_[a-f0-9]{20}$/.test(testDatabase) ||
  new URL(process.env.DATABASE_URL!).pathname !== `/${testDatabase}`
)
  throw new Error("Run with pnpm test:backend using an isolated database.");
const password = process.env.QURBAN_BACKEND_TEST_PASSWORD!;
const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
function day(offset = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(Date.now() + offset * 86400000),
  );
}
async function login(
  request: APIRequestContext,
  email = "backend@example.test",
  secret = password,
) {
  const response = await signIn(request, email, secret);
  expect(response.status(), await response.text()).toBe(200);
}
async function signIn(
  request: APIRequestContext,
  email: string,
  secret: string,
) {
  let response = await request.post("/api/auth/sign-in/email", {
    headers: { origin },
    data: { email, password: secret },
  });
  for (let retry = 0; response.status() === 429 && retry < 3; retry++) {
    await new Promise((resolve) => setTimeout(resolve, 10500));
    response = await request.post("/api/auth/sign-in/email", {
      headers: { origin },
      data: { email, password: secret },
    });
  }
  return response;
}
async function command(
  request: APIRequestContext,
  action: string,
  values: Record<string, unknown>,
  id?: string,
  periodId = "",
  requestId = randomUUID(),
) {
  return request.post("/api/qurban", {
    headers: { origin },
    data: { action, values, id, periodId, requestId },
  });
}
async function okCommand(
  request: APIRequestContext,
  action: string,
  values: Record<string, unknown>,
  id?: string,
  periodId = "",
) {
  const response = await command(request, action, values, id, periodId);
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(200);
  return body;
}
async function setup(
  request: APIRequestContext,
  expected = 1,
  estimate = 1000,
) {
  const [{ year: value }] =
    await sql`select greatest(coalesce(max(hijri_year), 5000), 5000)::int + 1 as year from qurban_periods`;
  const created = await okCommand(request, "period.save", {
    name: `Periode ${value}`,
    year: value,
    start: day(-20),
    end: day(10),
    due: day(20),
    date: day(30),
    notes: "Fixture terisolasi",
  });
  const periodId = created.result.id;
  await okCommand(
    request,
    "period.transition",
    { status: "open", reason: "Persiapan telah disepakati" },
    periodId,
    periodId,
  );
  const group = await okCommand(
    request,
    "group.save",
    {
      name: "Sapi 01",
      breed: "Sapi pengujian",
      expected,
      estimate,
      notes: "Kesepakatan fixture",
    },
    undefined,
    periodId,
  );
  return { periodId, groupId: group.result.id, year: value };
}
async function register(
  request: APIRequestContext,
  periodId: string,
  groupId = "",
  name = `Jamaah ${randomUUID().slice(0, 8)}`,
) {
  return okCommand(
    request,
    "participant.create",
    {
      name,
      phone: "6281234567890",
      group: groupId,
      registered: day(),
      address: "Alamat privat",
      notes: "Fixture terisolasi",
    },
    undefined,
    periodId,
  );
}
test.afterAll(async () => {
  await sql.end();
});

test("otorisasi server, signup publik, CSRF, dan sesi lama nonadmin", async ({
  request,
  playwright,
}) => {
  expect((await request.get("/api/qurban")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/sign-up/email", {
        headers: { origin },
        data: { name: "Publik", email: "signup@example.test", password },
      })
    ).status(),
  ).toBe(403);
  const id = randomUUID();
  const hash = await hashPassword(password);
  await sql`insert into "user" (id,name,email) values (${id},'User biasa','ordinary@example.test')`;
  await sql`insert into account (id,account_id,provider_id,user_id,password,updated_at) values (${randomUUID()},${id},'credential',${id},${hash},now())`;
  expect(
    (await signIn(request, "ordinary@example.test", password)).status(),
  ).toBe(401);
  await login(request);
  const csrf = await request.post("/api/qurban", {
    headers: { origin: "https://untrusted.example" },
    data: { action: "settings.save" },
  });
  expect(csrf.status()).toBe(403);
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  const publicResponse = await anonymous.get("/api/public/qurban");
  expect(publicResponse.status()).toBe(200);
  expect(Object.keys(await publicResponse.json()).sort()).toEqual([
    "aggregate",
    "period",
    "settings",
  ]);
  const state = await (await request.get("/api/qurban")).json();
  expect(state.accounts[0]).not.toHaveProperty("password");
  expect(state.accounts[0]).not.toHaveProperty("token");
  await anonymous.dispose();
});

test("UI tersambung: periode, peserta, setoran, reload, kuitansi, dan publik", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("backend@example.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk ke akun" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Periode", exact: true }).click();
  await page.getByRole("button", { name: "Buat periode", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nama periode").fill("Periode UI Persisten");
  await dialog.getByLabel("Tahun Hijriah").fill("4448");
  await dialog.getByLabel("Awal pendaftaran").fill(day(-10));
  await dialog.getByLabel("Akhir pendaftaran").fill(day(7));
  await dialog.getByLabel("Batas pelunasan").fill(day(14));
  await dialog.getByLabel("Rencana pelaksanaan").fill(day(21));
  await dialog.getByRole("button", { name: "Buat periode draf" }).click();
  await expect(dialog).not.toBeVisible();
  const card = page
    .locator(".q-period-card")
    .filter({ hasText: "Periode UI Persisten" });
  await card
    .getByRole("button", { name: "Buka pendaftaran", exact: true })
    .click();
  await dialog
    .getByLabel("Alasan / catatan rekonsiliasi")
    .fill("Pendaftaran dibuka untuk pengujian");
  await dialog.getByRole("button", { name: "Konfirmasi perubahan" }).click();
  await expect(dialog).not.toBeVisible();
  await card.getByRole("button", { name: "Jadikan sorotan" }).click();
  await expect(card.getByText("Sorotan publik", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Kelompok Sapi", exact: true }).click();
  await page.getByRole("button", { name: "Tambah kelompok" }).click();
  await dialog.getByLabel("Jumlah anggota disepakati").fill("1");
  await dialog.getByLabel("Estimasi total biaya").fill("1000");
  await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name: /^Peserta/ }).click();
  await page.getByRole("button", { name: "Tambah peserta" }).click();
  await dialog.getByLabel("Nama lengkap").fill("Jamaah Privat UI");
  await dialog.getByLabel("Nomor WhatsApp").fill("6281234567891");
  await expect(dialog.getByLabel("Penempatan kelompok")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Daftarkan peserta" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Jamaah Privat UI", { exact: true }),
  ).toBeVisible();
  const [{ group_id: unassigned }] =
    await sql`select group_id from qurban_registrations where qurban_name = 'Jamaah Privat UI'`;
  expect(unassigned).toBeNull();
  await page.getByRole("link", { name: "Kelompok Sapi", exact: true }).click();
  const groupCard = page
    .locator(".q-group-card")
    .filter({ hasText: "Sapi 01" });
  await groupCard
    .getByRole("button", { name: "Tambah peserta", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Pilih peserta kelompok" }).click();
  const picker = page.locator(".q-ms-popover");
  await picker
    .getByRole("searchbox", { name: "Cari peserta terdaftar" })
    .fill("Jamaah Privat UI");
  await picker
    .getByRole("checkbox", { name: "Jamaah Privat UI", exact: true })
    .click();
  await picker.getByRole("button", { name: "Selesai", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Tambahkan ke kelompok", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const [{ group_id: assigned }] =
    await sql`select group_id from qurban_registrations where qurban_name = 'Jamaah Privat UI'`;
  expect(assigned).toBeTruthy();
  await page.getByRole("link", { name: "Iuran Tunai", exact: true }).click();
  await page
    .getByRole("button", { name: "Catat setoran", exact: true })
    .click();
  await dialog
    .getByLabel("Peserta dan sisa kewajiban")
    .selectOption({ index: 1 });
  await dialog.getByLabel("Nominal tunai").fill("500");
  await dialog.getByRole("button", { name: "Simpan setoran" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page
    .locator(".q-table tbody tr")
    .filter({ hasText: "Jamaah Privat UI" })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { name: "Kuitansi tunai" }),
  ).toBeVisible();
  await expect(page.getByText(/CONTOH KUITANSI/)).toHaveCount(0);
  await mkdir("artifacts/backend", { recursive: true });
  await page.screenshot({
    path: "artifacts/backend/kuitansi-database.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Koreksi sekaligus" }).click();
  await expect(
    dialog.getByRole("button", { name: "Simpan koreksi sekaligus" }),
  ).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/backend/koreksi-mobile.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Tutup dialog" }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("link", { name: "Informasi Publik", exact: true })
    .click();
  await page
    .getByLabel("Nama panitia / program")
    .fill("Panitia Terhubung Database");
  await page.getByRole("button", { name: "Simpan informasi" }).click();
  await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nama panitia / program")).toHaveValue(
    "Panitia Terhubung Database",
  );
  await page.getByRole("link", { name: "Akun Panitia", exact: true }).click();
  await page.getByRole("button", { name: "Tambah panitia" }).click();
  await dialog.getByLabel("Nama lengkap").fill("Panitia UI Tersimpan");
  await dialog.getByLabel("Alamat email").fill("ui-admin@example.test");
  await dialog.getByLabel("Password awal").fill(password);
  await dialog.getByRole("button", { name: "Buat akun panitia" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByText("ui-admin@example.test", { exact: true }),
  ).toBeVisible();
  const pub = await page.request.get("/api/public/qurban");
  const data = await pub.json();
  expect(data.aggregate.registered).toBe(1);
  expect(data.aggregate.planned).toBe(1);
  expect(JSON.stringify(data)).not.toContain("Jamaah Privat UI");
  await page.goto("/");
  await expect(
    page.getByText("Periode UI Persisten", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText("Jamaah Privat UI")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("slot terakhir dan identitas sama dilindungi dari permintaan bersamaan", async ({
  request,
}) => {
  await login(request);
  const { periodId, groupId } = await setup(request);
  const result = await Promise.all(
    ["Jamaah Slot A", "Jamaah Slot B"].map((name) =>
      command(
        request,
        "participant.create",
        { name, phone: "6281234567890", registered: day(), group: groupId },
        undefined,
        periodId,
      ),
    ),
  );
  expect(result.map((r) => r.status()).sort()).toEqual([200, 409]);
  const [row] =
    await sql`select count(*)::int as count from qurban_registrations where group_id=${groupId} and status='active'`;
  expect(row.count).toBe(1);
  const other = await setup(request);
  const conflict = await command(
    request,
    "participant.create",
    {
      name: "Lintas Periode",
      phone: "6281234567892",
      registered: day(),
      group: groupId,
    },
    undefined,
    other.periodId,
  );
  expect(conflict.status()).toBe(422);
});

test("deposit/refund bersamaan, idempotensi, dan void negatif diperiksa secara atomik", async ({
  request,
}) => {
  await login(request);
  const { periodId, groupId } = await setup(request);
  const person = await register(request, periodId, groupId);
  const id = person.result.id;
  const before =
    await sql`select count(*)::int as count from audit_logs where period_id=${periodId}`;
  const bad = await command(
    request,
    "cash.create",
    { participant: id, type: "deposit", amount: 1001, date: day() },
    undefined,
    periodId,
  );
  expect(bad.status()).toBe(422);
  expect(
    (
      await command(
        request,
        "cash.create",
        { participant: id, type: "deposit", amount: 0.5, date: day() },
        undefined,
        periodId,
      )
    ).status(),
  ).toBe(422);
  expect(
    (
      await command(
        request,
        "cash.create",
        {
          participant: id,
          type: "deposit",
          amount: 1,
          date: day(),
          paymentMethod: "transfer",
        },
        undefined,
        periodId,
      )
    ).status(),
  ).toBe(422);
  expect(
    (
      await sql`select count(*)::int as count from audit_logs where period_id=${periodId}`
    )[0].count,
  ).toBe(before[0].count);
  const attempts = await Promise.all(
    [1, 2].map(() =>
      command(
        request,
        "cash.create",
        { participant: id, type: "deposit", amount: 600, date: day() },
        undefined,
        periodId,
      ),
    ),
  );
  expect(attempts.map((r) => r.status()).sort()).toEqual([200, 422]);
  const deposit = await attempts.find((r) => r.status() === 200)!.json();
  const refunds = await Promise.all(
    [1, 2].map(() =>
      command(
        request,
        "cash.create",
        {
          participant: id,
          type: "refund",
          amount: 500,
          date: day(),
          notes: "Uang dikembalikan secara tunai",
        },
        undefined,
        periodId,
      ),
    ),
  );
  expect(refunds.map((r) => r.status()).sort()).toEqual([200, 422]);
  const negative = await command(
    request,
    "cash.void",
    { reason: "Salah input setoran awal" },
    deposit.result.id,
    periodId,
  );
  expect(negative.status()).toBe(422);
  expect((await negative.json()).error).toContain("negatif");
  const requestId = randomUUID();
  const payload = {
    participant: id,
    type: "deposit",
    amount: 100,
    date: day(),
    notes: "Coba ulang jaringan",
  };
  const retries = await Promise.all(
    [1, 2].map(() =>
      command(request, "cash.create", payload, undefined, periodId, requestId),
    ),
  );
  expect(retries.map((r) => r.status())).toEqual([200, 200]);
  expect((await retries[0].json()).result.id).toBe(
    (await retries[1].json()).result.id,
  );
  expect(
    (
      await sql`select count(*)::int as count from cash_transactions where idempotency_key=${requestId}`
    )[0].count,
  ).toBe(1);
  const changed = await command(
    request,
    "cash.create",
    { ...payload, amount: 99 },
    undefined,
    periodId,
    requestId,
  );
  expect(changed.status()).toBe(409);
});

test("harga final rata, pengembalian kelebihan, pembelian, pelaksanaan, dan arsip", async ({
  request,
}) => {
  await login(request);
  const { periodId, groupId } = await setup(request, 1, 1000);
  const person = await register(request, periodId, groupId);
  const id = person.result.id;
  const requestId = randomUUID();
  const payload = {
    participant: id,
    type: "deposit",
    amount: 1000,
    date: day(),
  };
  expect(
    (
      await command(
        request,
        "cash.create",
        payload,
        undefined,
        periodId,
        requestId,
      )
    ).status(),
  ).toBe(200);
  const locked = await okCommand(
    request,
    "group.lock",
    { final: 900, reason: "Harga final turun dan disepakati" },
    groupId,
    periodId,
  );
  expect(
    locked.state.groups.find((g: { id: string }) => g.id === groupId).status,
  ).toBe("collecting");
  const refunded = await okCommand(
    request,
    "cash.create",
    {
      participant: id,
      type: "refund",
      amount: 100,
      date: day(),
      notes: "Pengembalian kelebihan akibat target turun",
    },
    undefined,
    periodId,
  );
  expect(
    refunded.state.groups.find((g: { id: string }) => g.id === groupId).status,
  ).toBe("ready");
  await okCommand(
    request,
    "group.purchase",
    { cost: 850, date: day(), notes: "Bukti pembelian fixture" },
    groupId,
    periodId,
  );
  expect(
    (
      await command(
        request,
        "group.reopen",
        { reason: "Mencoba mengubah sapi dibeli" },
        groupId,
        periodId,
      )
    ).status(),
  ).toBe(422);
  await okCommand(
    request,
    "group.slaughter",
    { date: day() },
    groupId,
    periodId,
  );
  await okCommand(
    request,
    "period.transition",
    { status: "closed", reason: "Pendaftaran telah diselesaikan" },
    periodId,
    periodId,
  );
  await okCommand(
    request,
    "period.transition",
    { status: "completed", reason: "Keuangan telah direkonsiliasi" },
    periodId,
    periodId,
  );
  await okCommand(
    request,
    "period.transition",
    { status: "archived", reason: "Arsip pelaksanaan terverifikasi" },
    periodId,
    periodId,
  );
  expect(
    (
      await command(
        request,
        "cash.create",
        { participant: id, type: "deposit", amount: 1, date: day() },
        undefined,
        periodId,
      )
    ).status(),
  ).toBe(422);
  expect(
    (
      await command(
        request,
        "cash.create",
        payload,
        undefined,
        periodId,
        requestId,
      )
    ).status(),
  ).toBe(200);
  await okCommand(request, "period.feature", {}, periodId, periodId);
  const publicData = await (await request.get("/api/public/qurban")).json();
  expect(publicData.aggregate).toEqual({
    registered: 1,
    grouped: 1,
    planned: 1,
    funded: 1,
    purchased: 1,
    slaughtered: 1,
  });
});

test("pembulatan kelompok, daftar tunggu, pembatalan, dan peserta lama lintas periode", async ({
  request,
}) => {
  await login(request);
  const { periodId, groupId } = await setup(request, 2, 1001);
  const first = await register(request, periodId, groupId);
  const second = await register(request, periodId, groupId);
  await sql`update qurban_registrations set slot_number=7 where id=${second.result.id}`;
  await okCommand(
    request,
    "group.save",
    { name: "Sapi 01", breed: "Sapi pengujian", expected: 2, estimate: 1001 },
    groupId,
    periodId,
  );
  expect(
    (
      await sql`select slot_number from qurban_registrations where id=${second.result.id}`
    )[0].slot_number,
  ).toBe(2);
  const participant = first.state.participants.find(
    (p: { id: string }) => p.id === first.result.id,
  );
  const locked = await okCommand(
    request,
    "group.lock",
    { final: 1001, reason: "Pembulatan satu rupiah disepakati penggunaannya" },
    groupId,
    periodId,
  );
  expect(
    locked.state.groups.find((g: { id: string }) => g.id === groupId).final,
  ).toBe(1001);
  expect(
    (
      await command(
        request,
        "participant.assign",
        { group: "" },
        first.result.id,
        periodId,
      )
    ).status(),
  ).toBe(422);
  await okCommand(
    request,
    "group.reopen",
    { reason: "Komposisi akan disepakati ulang" },
    groupId,
    periodId,
  );
  await okCommand(
    request,
    "participant.cancel",
    { reason: "Peserta menunda pelaksanaan" },
    first.result.id,
    periodId,
  );
  const reactivated = await okCommand(
    request,
    "participant.reactivate",
    { reason: "Peserta kembali melanjutkan" },
    first.result.id,
    periodId,
  );
  expect(reactivated.result.id).toBe(first.result.id);
  expect(
    reactivated.state.participants.find(
      (p: { id: string }) => p.id === first.result.id,
    ).groupId,
  ).toBe("");
  expect(
    (
      await command(
        request,
        "cash.create",
        {
          participant: first.result.id,
          type: "deposit",
          amount: 1,
          date: day(),
        },
        undefined,
        periodId,
      )
    ).status(),
  ).toBe(422);
  const other = await setup(request);
  const reuse = await okCommand(
    request,
    "participant.create",
    {
      existing: participant.participantId,
      group: other.groupId,
      registered: day(),
    },
    undefined,
    other.periodId,
  );
  expect(
    reuse.state.participants.filter(
      (p: { participantId: string }) =>
        p.participantId === participant.participantId,
    ),
  ).toHaveLength(2);
  expect(second.result.id).toBeTruthy();
});

test("batas tanggal menggunakan waktu server, refund tetap dapat diselesaikan", async ({
  request,
}) => {
  await login(request);
  const { periodId, groupId, year: hijri } = await setup(request);
  const person = await register(request, periodId, groupId);
  await okCommand(
    request,
    "cash.create",
    {
      participant: person.result.id,
      type: "deposit",
      amount: 200,
      date: day(),
    },
    undefined,
    periodId,
  );
  await okCommand(
    request,
    "period.save",
    {
      name: "Periode lewat tenggat",
      year: hijri,
      start: day(-20),
      end: day(-3),
      due: day(-2),
      date: day(30),
      reason: "Jadwal disesuaikan setelah rekonsiliasi",
    },
    periodId,
    periodId,
  );
  const late = await command(
    request,
    "cash.create",
    {
      participant: person.result.id,
      type: "deposit",
      amount: 100,
      date: day(-3),
    },
    undefined,
    periodId,
  );
  expect(late.status()).toBe(422);
  expect((await late.json()).error).toContain("Batas pelunasan");
  await okCommand(
    request,
    "cash.create",
    {
      participant: person.result.id,
      type: "refund",
      amount: 100,
      date: day(),
      notes: "Pengembalian setelah batas pelunasan",
    },
    undefined,
    periodId,
  );
  expect(
    (
      await command(
        request,
        "participant.create",
        {
          name: "Peserta terlambat",
          phone: "6281234567893",
          registered: day(-4),
        },
        undefined,
        periodId,
      )
    ).status(),
  ).toBe(422);
});

test("akun panitia nyata, penonaktifan sesi, serta password pribadi", async ({
  request,
  playwright,
}) => {
  await login(request);
  const created = await okCommand(request, "admin.save", {
    name: "Panitia Kedua",
    email: "second@example.test",
    password,
  });
  const second = await playwright.request.newContext({ baseURL: origin });
  await login(second, "second@example.test");
  expect((await second.get("/api/qurban")).status()).toBe(200);
  // Keep the valid session to prove the allowlist is checked on every request.
  await sql`update committee_admins set is_active=false where user_id=${created.result.id}`;
  expect((await second.get("/api/qurban")).status()).toBe(403);
  expect((await second.get("/api/account")).status()).toBe(403);
  await sql`update committee_admins set is_active=true where user_id=${created.result.id}`;
  await okCommand(
    request,
    "admin.toggle",
    { active: false, reason: "Masa tugas panitia telah selesai" },
    created.result.id,
  );
  expect([401, 403]).toContain((await second.get("/api/qurban")).status());
  expect((await signIn(second, "second@example.test", password)).status()).toBe(
    401,
  );
  const state = await (await request.get("/api/qurban")).json();
  expect(
    (
      await command(
        request,
        "admin.toggle",
        { active: false, reason: "Mencoba menonaktifkan diri" },
        state.accounts[0].id,
      )
    ).status(),
  ).toBe(422);
  await okCommand(
    request,
    "admin.toggle",
    { active: true, reason: "Panitia kembali mendapat penugasan" },
    created.result.id,
  );
  await login(second, "second@example.test");
  expect(
    (
      await command(second, "account.password", {
        current: "password salah",
        password: "PasswordBaruPengujian42!",
        confirm: "PasswordBaruPengujian42!",
      })
    ).status(),
  ).toBe(422);
  const changed = await okCommand(second, "account.password", {
    current: password,
    password: "PasswordBaruPengujian42!",
    confirm: "PasswordBaruPengujian42!",
  });
  expect(changed.result.reauthenticate).toBe(true);
  expect((await second.get("/api/qurban")).status()).toBe(401);
  await login(second, "second@example.test", "PasswordBaruPengujian42!");
  await second.dispose();
});

test("koreksi berantai atomik, dapat dicoba ulang, dan tidak menghapus riwayat", async ({
  request,
}) => {
  await login(request);
  const { periodId, groupId } = await setup(request);
  const person = await register(request, periodId, groupId);
  const id = person.result.id;
  const deposit = await okCommand(
    request,
    "cash.create",
    { participant: id, type: "deposit", amount: 600, date: day() },
    undefined,
    periodId,
  );
  const refund = await okCommand(
    request,
    "cash.create",
    {
      participant: id,
      type: "refund",
      amount: 500,
      date: day(),
      notes: "Pengembalian sebelum koreksi",
    },
    undefined,
    periodId,
  );
  const before =
    await sql`select count(*)::int as count from cash_transactions where registration_id=${id}`;
  const [original] =
    await sql`select idempotency_key from cash_transactions where id=${deposit.result.id}`;
  expect(
    (
      await command(
        request,
        "cash.correct",
        {
          ids: [deposit.result.id, refund.result.id],
          reason: "Key transaksi biasa tidak boleh dipakai koreksi",
        },
        undefined,
        periodId,
        original.idempotency_key,
      )
    ).status(),
  ).toBe(409);
  const invalid = await command(
    request,
    "cash.correct",
    {
      ids: [deposit.result.id],
      reason: "Koreksi tidak lengkap ditolak",
      replacement: {
        participant: id,
        type: "deposit",
        amount: 100,
        date: day(),
      },
    },
    undefined,
    periodId,
  );
  expect(invalid.status()).toBe(422);
  expect(
    (
      await sql`select voided_at from cash_transactions where id=${deposit.result.id}`
    )[0].voided_at,
  ).toBeNull();
  expect(
    (
      await sql`select count(*)::int as count from cash_transactions where registration_id=${id}`
    )[0].count,
  ).toBe(before[0].count);
  const requestId = randomUUID();
  const values = {
    ids: [deposit.result.id, refund.result.id],
    reason: "Koreksi setoran dan refund sekaligus",
    replacement: { participant: id, type: "deposit", amount: 100, date: day() },
  };
  const result = await command(
    request,
    "cash.correct",
    values,
    undefined,
    periodId,
    requestId,
  );
  expect(result.status(), await result.text()).toBe(200);
  const replay = await command(
    request,
    "cash.correct",
    values,
    undefined,
    periodId,
    requestId,
  );
  expect(replay.status()).toBe(200);
  expect((await replay.json()).result.replayed).toBe(true);
  const [aggregate] =
    await sql`select count(*)::int as count, count(*) filter(where voided_at is not null)::int as voids, sum(case when voided_at is not null then 0 when entry_type='deposit' then amount else -amount end)::int as net from cash_transactions where registration_id=${id}`;
  expect(aggregate).toEqual({ count: 3, voids: 2, net: 100 });
  expect(
    (
      await command(
        request,
        "cash.correct",
        { ...values, reason: "Payload koreksi berubah" },
        undefined,
        periodId,
        requestId,
      )
    ).status(),
  ).toBe(409);
  const completed = await result.json();
  const returned = await okCommand(
    request,
    "cash.create",
    {
      participant: id,
      type: "refund",
      amount: 100,
      date: day(),
      notes: "Seluruh setoran dikembalikan",
    },
    undefined,
    periodId,
  );
  await okCommand(
    request,
    "participant.cancel",
    { reason: "Peserta batal setelah pengembalian" },
    id,
    periodId,
  );
  await okCommand(
    request,
    "group.cancel",
    { reason: "Kelompok tidak dilaksanakan" },
    groupId,
    periodId,
  );
  const corrected = await okCommand(
    request,
    "cash.correct",
    {
      ids: [completed.result.replacementId, returned.result.id],
      reason: "Koreksi pasangan riwayat peserta batal",
    },
    undefined,
    periodId,
  );
  expect(
    corrected.state.groups.find((g: { id: string }) => g.id === groupId).status,
  ).toBe("cancelled");
  const reactivated = await okCommand(
    request,
    "participant.reactivate",
    { reason: "Mendaftar ulang melalui daftar tunggu" },
    id,
    periodId,
  );
  expect(
    reactivated.state.participants.find((p: { id: string }) => p.id === id)
      .groupId,
  ).toBe("");
});

test("total kelompok yang cukup tidak menutup kekurangan anggota lain", async ({
  request,
}) => {
  await login(request);
  const { periodId, groupId } = await setup(request, 2, 2000);
  const first = await register(request, periodId, groupId);
  const second = await register(request, periodId, groupId);
  await okCommand(
    request,
    "cash.create",
    { participant: first.result.id, type: "deposit", amount: 601, date: day() },
    undefined,
    periodId,
  );
  await okCommand(
    request,
    "cash.create",
    {
      participant: second.result.id,
      type: "deposit",
      amount: 401,
      date: day(),
    },
    undefined,
    periodId,
  );
  const locked = await okCommand(
    request,
    "group.lock",
    {
      final: 1001,
      reason: "Target akhir merata termasuk satu rupiah pembulatan",
    },
    groupId,
    periodId,
  );
  expect(
    locked.state.groups.find((g: { id: string }) => g.id === groupId).status,
  ).toBe("collecting");
  expect(
    (
      await command(
        request,
        "group.purchase",
        { cost: 1001, date: day() },
        groupId,
        periodId,
      )
    ).status(),
  ).toBe(422);
});

test("tag kelompok: modal dan rincian menyimpan peserta setelah reload", async ({
  page,
}) => {
  await login(page.request);
  const { periodId } = await setup(page.request, 2);
  const first = await register(
    page.request,
    periodId,
    "",
    "Jamaah Tag Pertama",
  );
  const second = await register(page.request, periodId, "", "Jamaah Tag Kedua");
  const third = await register(page.request, periodId, "", "Jamaah Tag Ketiga");
  await page.goto("/kelompok");
  await page.getByLabel("Pilih periode pengelolaan").selectOption(periodId);
  await page
    .getByRole("button", { name: "Tambah kelompok", exact: true })
    .click();
  const dialog = page.locator(".q-editor");
  await dialog.getByLabel("Nama kelompok").fill("Sapi Tag Persisten");
  await dialog.getByLabel("Jumlah anggota disepakati").fill("2");
  await dialog.getByRole("button", { name: "Pilih peserta kelompok" }).click();
  const picker = page.locator(".q-ms-popover");
  await picker
    .getByRole("searchbox", { name: "Cari peserta terdaftar" })
    .fill("Pertama");
  await picker
    .getByRole("checkbox", { name: "Jamaah Tag Pertama", exact: true })
    .click();
  await picker.getByRole("button", { name: "Selesai", exact: true }).click();
  await mkdir("artifacts/backend", { recursive: true });
  await page.screenshot({
    path: "artifacts/backend/tag-peserta-modal.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(dialog).not.toBeVisible();
  const [created] =
    await sql`select id from qurban_groups where period_id = ${periodId} and code = 'Sapi Tag Persisten'`;
  expect(created).toBeTruthy();
  await page
    .locator(".q-group-card")
    .filter({ hasText: "Sapi Tag Persisten" })
    .getByRole("link")
    .click();
  const form = page.locator(".q-group-participant-form");
  await expect(form.locator(".q-member-tag-saved")).toHaveCount(1);
  await form.getByRole("button", { name: "Pilih peserta kelompok" }).click();
  await picker
    .getByRole("searchbox", { name: "Cari peserta terdaftar" })
    .fill("Kedua");
  await picker
    .getByRole("checkbox", { name: "Jamaah Tag Kedua", exact: true })
    .click();
  await expect(
    picker.getByRole("checkbox", { name: "Jamaah Tag Kedua", exact: true }),
  ).toBeChecked();
  await expect(picker.getByRole("searchbox")).toBeEnabled();
  await picker.getByRole("button", { name: "Selesai", exact: true }).click();
  await form
    .getByRole("button", { name: "Tambah 1 peserta", exact: true })
    .click();
  await expect(form.locator(".q-member-tag-saved")).toHaveCount(2);
  await page.reload();
  await expect(form.locator(".q-member-tag-saved")).toHaveCount(2);
  await expect(page.locator(".q-table tbody tr")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Ubah kelompok", exact: true })
    .click();
  await dialog.getByLabel("Jumlah anggota disepakati").fill("3");
  await dialog.getByRole("button", { name: "Pilih peserta kelompok" }).click();
  await picker
    .getByRole("searchbox", { name: "Cari peserta terdaftar" })
    .fill("Ketiga");
  await picker
    .getByRole("checkbox", { name: "Jamaah Tag Ketiga", exact: true })
    .click();
  await picker.getByRole("button", { name: "Selesai", exact: true }).click();
  await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(form.locator(".q-member-tag-saved")).toHaveCount(3);
  const stored =
    await sql`select id, group_id, slot_number from qurban_registrations where id in (${first.result.id}, ${second.result.id}, ${third.result.id}) order by slot_number`;
  expect(stored.map((r) => r.group_id)).toEqual([
    created.id,
    created.id,
    created.id,
  ]);
  expect(stored.map((r) => r.slot_number)).toEqual([1, 2, 3]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/backend/tag-peserta-rincian-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("tag kelompok: validasi batch, rollback, dan persaingan slot", async ({
  request,
}) => {
  await login(request);
  const { periodId, groupId } = await setup(request, 2);
  const people = [];
  for (let i = 0; i < 5; i++)
    people.push((await register(request, periodId)).result.id);
  const ids = people.slice(0, 4);
  const cancelled = people[4];
  await okCommand(
    request,
    "participant.cancel",
    { reason: "Peserta menunda pendaftaran" },
    cancelled,
    periodId,
  );
  const foreign = await setup(request);
  const foreignPerson = (await register(request, foreign.periodId)).result.id;
  for (const [memberIds, expectedStatus] of [
    [[ids[0], ids[0]], 422],
    [[randomUUID()], 422],
    [[foreignPerson], 422],
    [[cancelled], 409],
    [ids.slice(0, 3), 409],
  ] as [string[], number][]) {
    const response = await command(
      request,
      "group.add-members",
      { memberIds },
      groupId,
      periodId,
    );
    expect(response.status(), await response.text()).toBe(expectedStatus);
  }
  const rollback = await command(
    request,
    "group.save",
    {
      name: "Sapi Rollback Tag",
      expected: 2,
      estimate: 1000,
      memberIds: ids.slice(0, 3),
    },
    undefined,
    periodId,
  );
  expect(rollback.ok()).toBe(false);
  expect(
    await sql`select id from qurban_groups where period_id = ${periodId} and code = 'Sapi Rollback Tag'`,
  ).toHaveLength(0);
  expect(
    await sql`select id from qurban_registrations where group_id = ${groupId}`,
  ).toHaveLength(0);
  const attempts = await Promise.all([
    command(
      request,
      "group.add-members",
      { memberIds: ids.slice(0, 2) },
      groupId,
      periodId,
    ),
    command(
      request,
      "group.add-members",
      { memberIds: ids.slice(2, 4) },
      groupId,
      periodId,
    ),
  ]);
  expect(attempts.map((r) => r.status()).sort()).toEqual([200, 409]);
  const assigned =
    await sql`select id, slot_number from qurban_registrations where group_id = ${groupId} order by slot_number`;
  expect(assigned.map((r) => r.slot_number)).toEqual([1, 2]);
  const assignedIds = assigned.map((r) => r.id);
  const remaining = ids.filter((id) => !assignedIds.includes(id));
  const mixed = await command(
    request,
    "group.save",
    {
      name: "Sapi Tidak Boleh Berubah",
      expected: 4,
      estimate: 2000,
      memberIds: [remaining[0], assignedIds[0]],
    },
    groupId,
    periodId,
  );
  expect(mixed.status()).toBe(409);
  const [{ code, expected_members, estimated_total }] =
    await sql`select code, expected_members, estimated_total from qurban_groups where id = ${groupId}`;
  expect({ code, expected_members, estimated_total }).toEqual({
    code: "Sapi 01",
    expected_members: 2,
    estimated_total: "1000",
  });
  await okCommand(
    request,
    "group.lock",
    { final: 1000, reason: "Harga telah disepakati" },
    groupId,
    periodId,
  );
  const locked = await command(
    request,
    "group.add-members",
    { memberIds: [remaining[0]] },
    groupId,
    periodId,
  );
  expect(locked.status()).toBe(422);
  expect((await locked.json()).error).toContain("Buka kembali kelompok");
  expect(
    await sql`select id from audit_logs where entity_id in (${assignedIds[0]}, ${assignedIds[1]}) and action = 'Kelompok peserta diperbarui'`,
  ).toHaveLength(2);
});

test("login admin bootstrap mempertahankan sesi setelah reload", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("BACKEND@EXAMPLE.TEST");
  await page
    .getByLabel("Kata sandi", { exact: true })
    .fill(`Salah-${randomUUID()}`);
  await page.getByRole("button", { name: "Masuk ke akun" }).click();
  await expect(page.locator(".q-login-form [role=alert]")).toContainText(
    "Email atau kata sandi tidak sesuai",
  );
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk ke akun" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await page.request.get("/api/account")).status()).toBe(200);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await page.request.get("/api/account")).status()).toBe(200);
  const rejected = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: "https://origin-tidak-diizinkan.invalid" },
    data: { email: "backend@example.test", password },
  });
  expect(rejected.status()).toBe(403);
  expect((await rejected.json()).code).toBe("INVALID_ORIGIN");
});
