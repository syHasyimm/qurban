import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile: semua halaman dan detail tetap terbaca tanpa overflow", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir("artifacts/mobile", { recursive: true });
  for (const path of [
    "dashboard",
    "peserta",
    "kelompok",
    "iuran",
    "periode",
    "laporan",
    "informasi-publik",
    "akun-panitia",
    "aktivitas",
    "peserta/peserta-8",
    "kelompok/sapi-03",
    "iuran/trx-1",
  ]) {
    await page.goto(`/preview/${path}`);
    await expect(
      page.getByRole("navigation", { name: "Navigasi aplikasi mobile" }),
    ).toBeVisible();
    await expect(page.locator(".qm-bottom-nav")).toHaveCSS("position", "fixed");
    await expect(page.locator("main h1").first()).toBeAttached();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/mobile/${path.replaceAll("/", "-")}.png`,
      fullPage: true,
    });
    if (path === "dashboard")
      await page.screenshot({
        path: "artifacts/mobile/dashboard-viewport.png",
      });
  }
  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "/preview/dashboard",
      "/preview/peserta",
      "/preview/laporan",
      "/",
      "/login",
    ]) {
      await page.goto(route);
      if (route.includes("preview"))
        await expect(page.locator(".qm-bottom-nav")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} @ ${width}`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test("mobile: menu terang, periode, dan batas periode arsip", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/preview/dashboard");
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.locator(".qm-header-home")).toHaveCSS(
    "background-color",
    "rgb(237, 249, 243)",
  );
  await page.getByRole("button", { name: "Semua menu", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Semua menu" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Gelap", exact: true }),
  ).toHaveCount(0);
  await expect(dialog).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.screenshot({ path: "artifacts/mobile/menu-light.png" });
  await dialog
    .getByRole("link", { name: "Kelompok sapi", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Pilih periode pengelolaan mobile" })
    .click();
  await dialog.getByRole("button", { name: /Qurban 1447 H/ }).click();
  await expect(
    page.getByText("Diarsipkan · Hanya baca", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tambah kelompok", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".qm-setor")).toBeDisabled();
});

test("mobile: pencatatan setoran diperiksa sebelum disimpan dan menghasilkan kuitansi", async ({
  page,
}) => {
  await page.goto("/preview/dashboard");
  await page.getByRole("button", { name: "Setor", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Cari peserta transaksi" })
    .fill("Budi");
  await dialog.getByRole("button", { name: /Budi Santoso/ }).click();
  await dialog
    .getByRole("textbox", { name: "Nominal tunai (Rp)" })
    .fill("3000000");
  await dialog
    .getByRole("button", { name: "Periksa setoran", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "melebihi sisa kewajiban",
  );
  await dialog
    .getByRole("textbox", { name: "Nominal tunai (Rp)" })
    .fill("100000");
  await dialog
    .getByRole("button", { name: "Periksa setoran", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Periksa setoran", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Simpan setoran", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "artifacts/mobile/setoran-review.png" });
  await dialog
    .getByRole("button", { name: "Simpan setoran", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Setoran berhasil dicatat" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("KWT-1448-0018", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/mobile/setoran-success.png" });
  await dialog
    .getByRole("link", { name: "Lihat kuitansi", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kuitansi tunai", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".q-receipt")).toContainText("Budi Santoso");
  await expect(page.locator(".q-receipt")).toContainText("CONTOH KUITANSI");
});

test("mobile: form penuh layar melindungi perubahan dan pencarian dipulihkan", async ({
  page,
}) => {
  await page.goto("/preview/peserta");
  const search = page.getByRole("textbox", {
    name: "Cari nama atau nomor peserta…",
  });
  await search.fill("Budi");
  await page
    .getByRole("link", { name: /Budi Santoso/ })
    .first()
    .click();
  await expect(
    page.getByRole("link", { name: "Catat setoran", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Kembali ke Peserta", exact: true })
    .click();
  await expect(search).toHaveValue("Budi");
  await page
    .getByRole("button", { name: "Tambah peserta", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Daftarkan jamaah baru" }).click();
  await dialog.getByLabel("Nama lengkap").fill("Peserta belum disimpan");
  await expect(dialog).toHaveCSS("width", "390px");
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Buang perubahan?" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Lanjut mengisi", exact: true })
    .click();
  await expect(dialog.getByLabel("Nama lengkap")).toHaveValue(
    "Peserta belum disimpan",
  );
  await page.screenshot({ path: "artifacts/mobile/form-peserta.png" });
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Buang perubahan", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
});

test("mobile: aksi setoran berulang dan peserta dari detail tidak kehilangan konteks", async ({
  page,
}) => {
  await page.goto("/preview/peserta/peserta-8");
  await page.getByRole("link", { name: "Catat setoran", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Budi Santoso", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Nominal tunai (Rp)" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Tutup pencatatan" }).click();
  await expect(page).toHaveURL(/\/preview\/peserta\/peserta-8$/);
  await page.locator(".qm-setor").click();
  await expect(
    dialog.getByRole("textbox", { name: "Cari peserta transaksi" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Tutup pencatatan" }).click();
  await page
    .locator(".qm-bottom-nav")
    .getByRole("link", { name: "Riwayat" })
    .click();
  await page.locator(".qm-setor").click();
  await expect(
    dialog.getByRole("textbox", { name: "Cari peserta transaksi" }),
  ).toBeVisible();
});

test("mobile: filter, detail periode, ekspor, dan pratinjau publik", async ({
  page,
}) => {
  await page.goto("/preview/peserta");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Status pembayaran").selectOption("paid");
  await dialog.getByRole("button", { name: "Tampilkan hasil" }).click();
  await expect(page.locator(".q-pagination")).toContainText("dari 8 peserta");
  await page.goto("/preview/periode");
  await page
    .locator(".qm-period-card")
    .filter({ hasText: "Qurban 1449 H" })
    .click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Detail Qurban 1449 H" }),
  ).toBeAttached();
  await dialog
    .getByRole("button", { name: "Buka pendaftaran", exact: true })
    .click();
  await dialog
    .getByLabel("Alasan / catatan rekonsiliasi")
    .fill("Persiapan periode baru telah selesai");
  await dialog.getByRole("button", { name: "Konfirmasi perubahan" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".qm-period-card").filter({ hasText: "Qurban 1449 H" }),
  ).toContainText("Pendaftaran dibuka");
  await page.goto("/preview/laporan");
  await page.getByRole("button", { name: "Ekspor", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ekspor CSV" })
    .click();
  expect((await downloading).suggestedFilename()).toBe("ringkasan-1448.csv");
  await page.goto("/preview/informasi-publik");
  await page
    .getByRole("button", { name: "Lihat pratinjau", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Pratinjau publik", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: /Ringankan iuran/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/mobile/preview-publik.png",
    animations: "disabled",
  });
  await dialog
    .getByRole("button", { name: "Kembali mengedit", exact: true })
    .click();
  await expect(page.getByLabel("Nama panitia / program")).toBeVisible();
});

test("mobile: pengembalian dan void tetap menjaga riwayat kuitansi", async ({
  page,
}) => {
  await page.goto("/preview/peserta/peserta-8");
  await page
    .getByRole("link", { name: "Catat pengembalian", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Nominal tunai (Rp)" })
    .fill("100000");
  await dialog
    .getByLabel("Alasan pengembalian")
    .fill("Pengembalian tunai sesuai kesepakatan peserta");
  await dialog
    .getByRole("button", { name: "Periksa pengembalian", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Simpan pengembalian", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Pengembalian berhasil dicatat" }),
  ).toBeVisible();
  await dialog
    .getByRole("link", { name: "Lihat kuitansi", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tindakan transaksi", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Void transaksi ini", exact: true })
    .click();
  await dialog
    .getByLabel("Alasan void")
    .fill("Koreksi pencatatan pengembalian tunai");
  await dialog
    .getByRole("button", { name: "Void transaksi", exact: true })
    .click();
  await expect(page.locator(".q-receipt")).toContainText("Void");
  await expect(page.locator(".q-receipt")).toContainText(
    "Koreksi pencatatan pengembalian tunai",
  );
});

test("mobile: pembelian dan pelaksanaan melalui pemeriksaan sebelum simpan", async ({
  page,
}) => {
  await page.goto("/preview/kelompok/sapi-01");
  await page
    .getByRole("button", { name: "Catat pembelian", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Harga beli sapi").fill("27500000");
  await dialog.getByRole("button", { name: "Periksa perubahan" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Periksa sebelum menyimpan" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Simpan pembelian", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("Sudah dibeli");
  await page
    .getByRole("button", { name: "Catat pelaksanaan", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Periksa perubahan" }).click();
  await dialog
    .getByRole("button", { name: "Tandai sudah dikurbankan", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("Sudah dikurbankan");
});
