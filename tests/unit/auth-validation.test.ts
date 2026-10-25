import { describe, expect, it } from "vitest";
import {
  loginSchema,
  profileSchema,
  registerSchema,
} from "@/lib/validations/auth";

const credentials = { email: "rafi@example.test", password: "KataSandiUji42!" };

describe("validasi autentikasi", () => {
  it("menormalisasi email tanpa mengubah kata sandi", () => {
    const result = loginSchema.parse({
      email: "  RAFI@example.test  ",
      password: "  spasi tetap ada  ",
    });
    expect(result.email).toBe("rafi@example.test");
    expect(result.password).toBe("  spasi tetap ada  ");
  });

  it.each(["bukan-email", "rafi@", ""])(
    'menolak email tidak valid: "%s"',
    (email) => {
      expect(loginSchema.safeParse({ ...credentials, email }).success).toBe(
        false,
      );
    },
  );

  it.each(["pendek", "a".repeat(129)])(
    "menolak panjang kata sandi di luar batas",
    (password) => {
      expect(loginSchema.safeParse({ ...credentials, password }).success).toBe(
        false,
      );
    },
  );

  it("menempatkan kesalahan konfirmasi pada field yang sesuai", () => {
    const result = registerSchema.safeParse({
      ...credentials,
      name: "Rafi Pengujian",
      confirmPassword: "Berbeda42!",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("menerima pendaftaran lengkap dan membersihkan spasi nama", () => {
    const result = registerSchema.parse({
      ...credentials,
      name: "  Rafi Pengujian  ",
      confirmPassword: credentials.password,
    });
    expect(result.name).toBe("Rafi Pengujian");
  });

  it.each([" ", "a", "a".repeat(81)])(
    "menolak nama yang kosong atau di luar batas",
    (name) => {
      expect(profileSchema.safeParse({ name }).success).toBe(false);
    },
  );
});
