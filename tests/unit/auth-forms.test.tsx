import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/shared/login-form";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: mocks.signIn },
    signUp: { email: mocks.signUp },
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

beforeEach(() => {
  mocks.signIn.mockReset();
  mocks.signUp.mockReset();
});

describe("form autentikasi", () => {
  it("menampilkan validasi tanpa memanggil server untuk form kosong", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Masuk ke akun" }));
    expect(
      await screen.findByText("Masukkan alamat email yang valid."),
    ).toBeVisible();
    expect(screen.getByText("Kata sandi minimal 8 karakter.")).toBeVisible();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("menampilkan kegagalan login dan tetap berada di halaman login", async () => {
    mocks.signIn.mockResolvedValue({
      error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 },
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "rafi@example.test");
    await user.type(screen.getByLabelText("Kata sandi"), "KataSandiUji42!");
    await user.click(screen.getByRole("button", { name: "Masuk ke akun" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email atau kata sandi tidak sesuai, atau akses panitia tidak aktif.",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it.each([
    [
      { code: "INVALID_ORIGIN", status: 403 },
      "Alamat situs ini belum diizinkan",
    ],
    [{ status: 429 }, "Terlalu banyak percobaan login"],
    [{ status: 500 }, "Layanan login sedang mengalami gangguan"],
    [
      { code: "FAILED_TO_CREATE_SESSION", status: 401 },
      "Sesi login belum dapat dibuat",
    ],
  ])(
    "membedakan kegagalan layanan dari kata sandi salah: %j",
    async (error, message) => {
      mocks.signIn.mockResolvedValue({ error });
      const user = userEvent.setup();
      render(<LoginForm />);
      await user.type(screen.getByLabelText("Email"), "rafi@example.test");
      await user.type(screen.getByLabelText("Kata sandi"), "KataSandiUji42!");
      await user.click(screen.getByRole("button", { name: "Masuk ke akun" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(mocks.replace).not.toHaveBeenCalled();
    },
  );

  it("membuka dashboard setelah login berhasil", async () => {
    mocks.signIn.mockResolvedValue({
      data: { user: { name: "Rafi" } },
      error: null,
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "rafi@example.test");
    await user.type(screen.getByLabelText("Kata sandi"), "KataSandiUji42!");
    await user.click(screen.getByRole("button", { name: "Masuk ke akun" }));
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard"),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
