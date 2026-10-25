import { expect, test } from "@playwright/test";

test("halaman privat tetap dilindungi dan pendaftaran mandiri tidak ditampilkan", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/account")).status()).toBe(401);
  await expect(
    page.getByRole("heading", { name: "Masuk panitia", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /daftar|buat akun/i }),
  ).toHaveCount(0);
  await page.goto("/register");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Masuk ke akun" }).click();
  await expect(
    page.getByText("Masukkan alamat email yang valid."),
  ).toBeVisible();
  await expect(page.getByText("Kata sandi minimal 8 karakter.")).toBeVisible();
  await page.getByRole("link", { name: "Jelajahi pratinjau frontend" }).click();
  await expect(page).toHaveURL(/\/preview\/dashboard$/);
});
