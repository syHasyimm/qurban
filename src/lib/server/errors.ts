import "server-only";

export class DomainError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
export function ensure(
  condition: unknown,
  message: string,
  status = 422,
): asserts condition {
  if (!condition) throw new DomainError(message, status);
}
export function errorResponse(error: unknown) {
  const headers = { "Cache-Control": "private, no-store" };
  if (error instanceof DomainError)
    return Response.json(
      { error: error.message },
      { status: error.status, headers },
    );
  const cause =
    (error as { cause?: { code?: string }; code?: string })?.cause ??
    (error as { code?: string });
  if (cause?.code === "23505")
    return Response.json(
      {
        error:
          "Data sudah digunakan. Perbarui halaman dan periksa nomor, tahun, email, atau kepesertaan yang sama.",
      },
      { status: 409, headers },
    );
  if (["40001", "40P01", "55P03", "57014"].includes(cause?.code ?? ""))
    return Response.json(
      {
        error:
          "Data sedang diperbarui petugas lain. Coba lagi dengan permintaan yang sama.",
      },
      { status: 409, headers },
    );
  console.error(
    "Qurban request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  if (error instanceof TypeError) console.error(error.stack);
  return Response.json(
    { error: "Permintaan belum dapat diselesaikan. Silakan coba lagi." },
    { status: 500, headers },
  );
}
