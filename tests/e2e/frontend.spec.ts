import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const sections = [
  ["dashboard", "Assalamu’alaikum, Pak Ahmad"],
  ["periode", "Periode Qurban"],
  ["peserta", "Peserta"],
  ["kelompok", "Kelompok Sapi"],
  ["iuran", "Iuran Tunai"],
  ["laporan", "Laporan"],
  ["informasi-publik", "Informasi Publik"],
  ["akun-panitia", "Akun Panitia"],
  ["aktivitas", "Riwayat Aktivitas"],
];

test("tag peserta di modal tambah dan ubah kelompok", async ({ page }) => {
  await page.goto("/preview/kelompok");
  await page
    .getByRole("button", { name: "Tambah kelompok", exact: true })
    .click();
  const dialog = page.locator(".q-editor");
  await dialog.getByLabel("Nama kelompok").fill("Sapi Tag");
  await dialog.getByLabel("Jumlah anggota disepakati").fill("1");
  await dialog.getByRole("button", { name: "Pilih peserta kelompok" }).click();
  const picker = page.locator(".q-ms-popover");
  const search = picker.getByRole("searchbox", {
    name: "Cari peserta terdaftar",
  });
  await search.fill("tidak ditemukan");
  await expect(picker.getByText("Peserta tidak ditemukan.")).toBeVisible();
  await search.fill("Ilham");
  await picker
    .getByRole("checkbox", { name: "M. Ilham Pratama", exact: true })
    .click();
  await expect(
    dialog.getByText("1 / 1 peserta", { exact: true }),
  ).toBeVisible();
  await expect(search).toBeEnabled();
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Selesai", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Hapus pilihan M. Ilham Pratama" })
    .click();
  await dialog.getByRole("button", { name: "Pilih peserta kelompok" }).click();
  await search.fill("Ilham");
  await search.press("Enter");
  await picker.getByRole("button", { name: "Selesai", exact: true }).click();
  await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .locator(".q-group-card")
    .filter({ hasText: "Sapi Tag" })
    .getByRole("link")
    .click();
  await expect(
    page.locator(".q-table tbody tr").filter({ hasText: "M. Ilham Pratama" }),
  ).toBeVisible();

  await page.goto("/preview/kelompok/sapi-03");
  await page
    .getByRole("button", { name: "Ubah kelompok", exact: true })
    .click();
  await expect(dialog.locator(".q-member-tag-saved")).toHaveCount(3);
  await dialog.getByRole("button", { name: "Pilih peserta kelompok" }).click();
  await search.fill("Ilham");
  await picker
    .getByRole("checkbox", { name: "M. Ilham Pratama", exact: true })
    .click();
  await picker.getByRole("button", { name: "Selesai", exact: true }).click();
  await dialog.getByLabel("Jumlah anggota disepakati").fill("3");
  await expect(
    dialog.getByText(/Jumlah pilihan melebihi kapasitas/),
  ).toBeVisible();
  await dialog.getByLabel("Jumlah anggota disepakati").fill("4");
  await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".q-member-tag-saved")).toHaveCount(4);
});

test("tambah peserta dengan tag langsung dari rincian pada ponsel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview/kelompok/sapi-03");
  await page.getByRole("button", { name: "Anggota", exact: true }).click();
  const form = page.locator(".q-group-participant-form");
  await expect(form.locator(".q-member-tag-saved")).toHaveCount(3);
  await form.getByRole("button", { name: "Pilih peserta kelompok" }).click();
  const picker = page.locator(".q-ms-mobile");
  await picker
    .getByRole("searchbox", { name: "Cari peserta terdaftar" })
    .fill("Ilham");
  await picker
    .getByRole("checkbox", { name: "M. Ilham Pratama", exact: true })
    .click();
  await picker.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(form.getByText("4 / 7 peserta", { exact: true })).toBeVisible();
  await form.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(form.locator(".q-member-tag-saved")).toHaveCount(3);
  await expect(
    form.getByRole("button", { name: "Hapus pilihan M. Ilham Pratama" }),
  ).toHaveCount(0);
  await form.getByRole("button", { name: "Pilih peserta kelompok" }).click();
  await picker
    .getByRole("searchbox", { name: "Cari peserta terdaftar" })
    .fill("Ilham");
  await picker
    .getByRole("checkbox", { name: "M. Ilham Pratama", exact: true })
    .click();
  await picker.getByRole("button", { name: "Selesai", exact: true }).click();
  await mkdir("artifacts/frontend", { recursive: true });
  await page.screenshot({
    path: "artifacts/frontend/tag-peserta-rincian-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await form
    .getByRole("button", { name: "Tambah 1 peserta", exact: true })
    .click();
  await expect(form.locator(".q-member-tag-saved")).toHaveCount(4);
  await expect(
    page.locator(".q-table tbody tr").filter({ hasText: "M. Ilham Pratama" }),
  ).toBeVisible();
  await form.getByRole("button", { name: "Pilih peserta kelompok" }).click();
  await expect(
    picker.getByText(
      "Semua peserta yang tersedia sudah dipilih atau dikelompokkan.",
    ),
  ).toBeVisible();
  await picker.getByRole("button", { name: "Selesai", exact: true }).click();
  await page.goto("/preview/kelompok/sapi-01");
  await expect(form.locator(".q-member-tag-saved")).toHaveCount(7);
  await expect(form.getByRole("textbox")).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`multiselect menyimpan beberapa peserta dari form kelompok pada ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/preview/peserta");
    const editor = page.locator(".q-editor");
    const names = ["Jamaah Multi Satu", "Jamaah Multi Dua"];
    for (const [index, name] of names.entries()) {
      await page
        .getByRole("button", { name: "Tambah peserta", exact: true })
        .click();
      if (width < 768)
        await editor
          .getByRole("button", { name: "Daftarkan jamaah baru" })
          .click();
      await editor.getByLabel("Nama lengkap").fill(name);
      await editor.getByLabel("Nomor WhatsApp").fill(`628123450000${index}`);
      await editor.getByRole("button", { name: "Daftarkan peserta" }).click();
      await expect(editor).not.toBeVisible();
    }
    if (width < 768) {
      await page
        .getByRole("button", { name: "Semua menu", exact: true })
        .click();
      await page
        .getByRole("link", { name: "Kelompok sapi", exact: true })
        .click();
    } else {
      await page
        .getByRole("link", { name: "Kelompok Sapi", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "Tambah kelompok", exact: true })
      .click();
    await editor.getByLabel("Nama kelompok").fill("Sapi Multi");
    await editor.getByLabel("Jumlah anggota disepakati").fill("2");
    await editor
      .getByRole("button", { name: "Pilih peserta kelompok" })
      .click();
    const picker = page.locator(width < 768 ? ".q-ms-mobile" : ".q-ms-popover");
    const search = picker.getByRole("searchbox", {
      name: "Cari peserta terdaftar",
    });
    await search.fill("Jamaah Multi");
    for (const name of names) {
      await picker.getByText(name, { exact: true }).click();
      await expect(
        picker.getByRole("checkbox", { name, exact: true }),
      ).toBeChecked();
      await expect(picker).toBeVisible();
    }
    await search.fill("");
    await expect(
      picker.getByRole("checkbox", { name: "M. Ilham Pratama", exact: true }),
    ).toBeDisabled();
    await expect(
      picker.getByRole("checkbox", { name: names[0], exact: true }),
    ).toBeEnabled();
    await expect(search).toBeEnabled();
    await mkdir("artifacts/frontend", { recursive: true });
    await page.screenshot({
      path: `artifacts/frontend/multiselect-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await picker.getByRole("button", { name: "Selesai", exact: true }).click();
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel("Nama kelompok")).toHaveValue("Sapi Multi");
    await editor
      .getByRole("button", { name: `Hapus pilihan ${names[0]}` })
      .click();
    await editor
      .getByRole("button", { name: "Pilih peserta kelompok" })
      .click();
    await expect(
      picker.getByRole("checkbox", { name: names[0], exact: true }),
    ).not.toBeChecked();
    await expect(
      picker.getByRole("checkbox", { name: names[1], exact: true }),
    ).toBeChecked();
    await picker.getByRole("checkbox", { name: names[0], exact: true }).click();
    await picker.getByRole("button", { name: "Selesai", exact: true }).click();
    await editor.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(editor).not.toBeVisible();
    await page
      .locator(".q-group-card")
      .filter({ hasText: "Sapi Multi" })
      .getByRole("link")
      .click();
    if (width < 768)
      await page.getByRole("button", { name: "Anggota", exact: true }).click();
    await expect(page.locator(".q-member-tag-saved")).toHaveCount(2);
    for (const name of names)
      await expect(
        page.locator(".q-table tbody tr").filter({ hasText: name }),
      ).toBeVisible();
  });
}

test("form data peserta sederhana dan data lama tidak meminta identitas ulang", async ({
  page,
}) => {
  await page.goto("/preview/peserta");
  await expect(
    page.getByRole("columnheader", { name: "WhatsApp", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Target iuran", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "Setoran bersih", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Pilih periode pengelolaan").selectOption("1449");
  await page.getByRole("link", { name: "Periode", exact: true }).click();
  const periodCard = page
    .locator(".q-period-card")
    .filter({ hasText: "Qurban 1449 H" });
  await periodCard
    .getByRole("button", { name: "Buka pendaftaran", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Alasan / catatan rekonsiliasi")
    .fill("Persiapan periode baru selesai");
  await dialog.getByRole("button", { name: "Konfirmasi perubahan" }).click();
  await page.getByRole("link", { name: /^Peserta/ }).click();
  await page
    .getByRole("button", { name: "Tambah peserta", exact: true })
    .first()
    .click();
  await dialog
    .getByLabel("Gunakan data peserta lama")
    .selectOption("peserta-1");
  await expect(dialog.getByLabel("Nama lengkap")).toHaveCount(0);
  await expect(dialog.getByLabel("Nomor WhatsApp")).toHaveCount(0);
  await dialog.getByLabel("Tanggal pendaftaran").fill("2027-06-01");
  await dialog.getByRole("button", { name: "Daftarkan peserta" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: /Ahmad Fauzi/ }).first(),
  ).toBeVisible();
  await expect(
    page
      .locator(".q-table tbody tr")
      .filter({ hasText: "Ahmad Fauzi" })
      .getByText("Belum berkelompok"),
  ).toBeVisible();
});

test("seluruh halaman desktop dan ponsel tampil tanpa error atau overflow", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir("artifacts/frontend", { recursive: true });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [slug, heading] of sections) {
      await page.goto(`/preview/${slug}`);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/frontend/${slug}-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Ringankan iuran/ }),
    ).toBeVisible();
    await expect(page.getByText("Ahmad Fauzi")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/frontend/public-${viewport.width}.png`,
      fullPage: true,
    });
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Masuk panitia", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/frontend/login-${viewport.width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("data peserta didaftarkan dahulu, penempatan dikelola melalui kelompok", async ({
  page,
}) => {
  await page.goto("/preview/peserta");
  await page.getByRole("button", { name: "Berikutnya" }).click();
  await expect(
    page.getByText("Menampilkan 9-16 dari 18 peserta"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Belum berkelompok", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /M. Ilham Pratama/ }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tambah peserta" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Penempatan kelompok")).toHaveCount(0);
  await dialog.getByLabel("Nama lengkap").fill("Zainal Pengujian");
  await dialog.getByLabel("Nomor WhatsApp").fill("6281234567890");
  await dialog.getByRole("button", { name: "Daftarkan peserta" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("link", { name: /Zainal Pengujian/ })
    .first()
    .click();
  await expect(
    page
      .getByRole("heading", { name: "Zainal Pengujian", exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Atur kelompok", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Pilih kelompok sapi", exact: true })
    .click();
  await expect(
    page.getByText("Pilih kelompok untuk Zainal Pengujian", { exact: true }),
  ).toBeVisible();
  const card = page.locator(".q-group-card").filter({ hasText: "Sapi 03" });
  await card
    .getByRole("button", { name: "Tambah peserta", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Hapus pilihan Zainal Pengujian" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Tambahkan ke kelompok", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await card.getByRole("link").click();
  await expect(
    page.locator(".q-table tbody tr").filter({ hasText: "Zainal Pengujian" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keluarkan Zainal Pengujian", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Keluarkan dari kelompok", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("link", { name: "Lihat data peserta", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /Cari nama atau nomor peserta/ })
    .fill("Zainal Pengujian");
  await page
    .getByRole("link", { name: /Zainal Pengujian/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Batalkan kepesertaan", exact: true })
    .click();
  await dialog.getByLabel("Alasan pembatalan").fill("Peserta menunda qurban");
  await dialog
    .getByRole("button", { name: "Batalkan kepesertaan", exact: true })
    .click();
  await expect(
    page.getByText("Dibatalkan", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Aktifkan kembali", exact: true })
    .click();
  await dialog
    .getByLabel("Alasan pengaktifan kembali")
    .fill("Peserta melanjutkan pendaftaran");
  await dialog
    .getByRole("button", { name: "Aktifkan kembali", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Belum berkelompok", exact: true }),
  ).toBeVisible();
});

test("setoran melampaui sisa ditolak, refund nyata dicatat, void negatif ditolak", async ({
  page,
}) => {
  await page.goto("/preview/iuran");
  await page
    .getByRole("button", { name: "Catat setoran", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Peserta dan sisa kewajiban")
    .selectOption("peserta-8");
  await dialog.getByLabel("Nominal tunai").fill("3000000");
  await dialog.getByRole("button", { name: "Simpan setoran" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "melebihi sisa kewajiban",
  );
  await dialog.getByLabel("Nominal tunai").fill("100000");
  await dialog.getByRole("button", { name: "Simpan setoran" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("KWT-1448-0018", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Pengembalian", exact: true })
    .first()
    .click();
  await dialog
    .getByLabel("Peserta dan sisa kewajiban")
    .selectOption("peserta-8");
  await dialog.getByLabel("Nominal tunai").fill("300000");
  await dialog
    .getByLabel("Alasan pengembalian")
    .fill("Pengembalian tunai sesuai kesepakatan");
  await dialog.getByRole("button", { name: "Simpan pengembalian" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Semua transaksi", exact: true })
    .click();
  await page
    .getByLabel("Cari peserta atau nomor kuitansi…")
    .fill("KWT-1448-0008");
  await page.getByRole("link", { name: "Kuitansi KWT-1448-0008" }).click();
  await expect(
    page.getByText("CONTOH KUITANSI", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Void transaksi ini" }).click();
  await dialog.getByLabel("Alasan void").fill("Koreksi nominal salah input");
  await dialog
    .getByRole("button", { name: "Void transaksi", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("negatif");
});

test("siklus kelompok siap, pembelian, dan pelaksanaan", async ({ page }) => {
  await page.goto("/preview/kelompok/sapi-01");
  await page.getByRole("button", { name: "Catat pembelian" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Harga beli sapi").fill("27500000");
  await dialog.getByRole("button", { name: "Simpan pembelian" }).click();
  await expect(page.getByText("Sudah dibeli", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buka kembali kelompok" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Catat pelaksanaan" }).click();
  await dialog
    .getByRole("button", { name: "Tandai sudah dikurbankan" })
    .click();
  await expect(
    page.getByText("Sudah dikurbankan", { exact: true }),
  ).toBeVisible();
});

test("kunci kelompok tidak lengkap ditolak dan periode arsip hanya baca", async ({
  page,
}) => {
  await page.goto("/preview/kelompok/sapi-03");
  await page.getByRole("button", { name: "Kunci harga dan anggota" }).click();
  await expect(page.getByText(/Lengkapi 7 anggota/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Pilih periode pengelolaan").selectOption("1447");
  await page.getByRole("link", { name: "Kelompok Sapi", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tambah kelompok" }),
  ).toBeDisabled();
  await expect(page.getByText("Belum ada kelompok yang sesuai")).toBeVisible();
  await page.getByRole("link", { name: /^Peserta/ }).click();
  await expect(
    page.getByRole("button", { name: "Tambah peserta" }),
  ).toBeDisabled();
});

test("periode memvalidasi urutan jadwal dan tahun unik", async ({ page }) => {
  await page.goto("/preview/periode");
  await page.getByRole("button", { name: "Buat periode", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Awal pendaftaran").fill("2029-05-01");
  await dialog.getByLabel("Akhir pendaftaran").fill("2029-04-01");
  await dialog.getByLabel("Batas pelunasan").fill("2029-04-10");
  await dialog.getByLabel("Rencana pelaksanaan").fill("2029-04-20");
  await dialog.getByRole("button", { name: "Buat periode draf" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Urutan tanggal");
  await dialog.getByLabel("Awal pendaftaran").fill("2028-06-01");
  await dialog.getByRole("button", { name: "Buat periode draf" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Qurban 1450 H" }),
  ).toBeVisible();
});

test("pengaturan publik memperbarui pratinjau dan tautan WhatsApp", async ({
  page,
}) => {
  await page.goto("/preview/informasi-publik");
  await page.getByLabel("Nama panitia / program").fill("Panitia Uji Frontend");
  await page.getByLabel("Nomor WhatsApp").fill("6281234567890");
  await page.getByRole("button", { name: "Simpan informasi" }).click();
  await expect(
    page
      .getByRole("status", { name: "" })
      .filter({ hasText: "Tersimpan di pratinjau" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pratinjau publik", exact: true })
    .click();
  await expect(
    page.getByText("Panitia Uji Frontend siap membantu langkah qurban Anda."),
  ).toBeVisible();
  const link = page
    .getByRole("link", {
      name: "Hubungi Panitia untuk Ikut Qurban",
      exact: true,
    })
    .first();
  await expect(link).toHaveAttribute(
    "href",
    /https:\/\/wa.me\/6281234567890\?text=/,
  );
  await expect(page.getByText("Ahmad Fauzi")).toHaveCount(0);
});

test("akun contoh dapat ditambah dan dinonaktifkan dengan alasan", async ({
  page,
}) => {
  await page.goto("/preview/akun-panitia");
  await page.getByRole("button", { name: "Tambah panitia" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nama lengkap").fill("Panitia Pengujian");
  await dialog.getByLabel("Alamat email").fill("frontend@example.test");
  await dialog.getByRole("button", { name: "Tambah ke daftar contoh" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Nonaktifkan Panitia Pengujian" })
    .click();
  await dialog
    .getByLabel("Alasan perubahan akses")
    .fill("Masa tugas telah selesai");
  await dialog.getByRole("button", { name: "Nonaktifkan akun contoh" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Panitia Pengujian" }),
  ).toContainText("Nonaktif");
  await page.getByRole("link", { name: "Riwayat Aktivitas" }).click();
  await expect(
    page.getByText("Panitia dinonaktifkan", { exact: true }),
  ).toBeVisible();
});

test("laporan dapat diekspor dan tetap terang meskipun preferensi perangkat gelap", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/preview/laporan");
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.locator(".q-app")).toHaveCSS(
    "background-color",
    "rgb(244, 250, 248)",
  );
  await page.getByRole("button", { name: "Peserta", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor CSV" }).click();
  expect((await download).suggestedFilename()).toBe("laporan-peserta-1448.csv");
  await expect(page.getByRole("button", { name: "Ubah tema" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.locator(".q-app")).toHaveCSS(
    "background-color",
    "rgb(244, 250, 248)",
  );
  await page.screenshot({
    path: "artifacts/frontend/report-light.png",
    fullPage: true,
  });
});

test("publik tanpa sorotan menampilkan pengumuman, tanpa menjumlahkan periode", async ({
  page,
}) => {
  await page.goto("/preview/periode");
  await page.getByRole("button", { name: "Hentikan sorotan" }).click();
  await page
    .getByRole("link", { name: "Informasi Publik", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pratinjau publik", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Informasi periode qurban akan diumumkan panitia.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Jamaah terdaftar", { exact: true })).toHaveCount(
    0,
  );
});

test("kuitansi responsif dan cetakan memiliki penanda data contoh", async ({
  page,
}) => {
  await mkdir("artifacts/frontend", { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview/iuran/trx-1");
  await expect(page.getByText("KWT-1448-0001", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/frontend/kuitansi-390.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1000, height: 1200 });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".q-sidebar")).not.toBeVisible();
  await expect(page.getByText(/CONTOH KUITANSI/)).toBeVisible();
  await page.screenshot({
    path: "artifacts/frontend/kuitansi-print.png",
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen" });
});
