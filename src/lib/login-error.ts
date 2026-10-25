type LoginError = { code?: string; status?: number };

export function loginErrorMessage(error: LoginError) {
  if (error.code === "INVALID_ORIGIN" || error.code === "INVALID_BASE_URL")
    return "Alamat situs ini belum diizinkan untuk login. Buka alamat resmi aplikasi atau hubungi pengelola.";
  if (error.status === 429 || error.code === "TOO_MANY_REQUESTS")
    return "Terlalu banyak percobaan login. Tunggu sebentar, lalu coba kembali.";
  if (error.code === "FAILED_TO_CREATE_SESSION")
    return "Sesi login belum dapat dibuat. Coba kembali atau hubungi pengelola.";
  if (error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD")
    return "Email atau kata sandi tidak sesuai, atau akses panitia tidak aktif.";
  if (error.status && error.status >= 500)
    return "Layanan login sedang mengalami gangguan. Coba kembali atau hubungi pengelola.";
  return "Login belum dapat diproses. Coba kembali atau hubungi pengelola.";
}
