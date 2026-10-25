import { z } from "zod";
import { env } from "@/lib/env";
import { apiAdmin } from "@/lib/session";
import { loadState } from "@/lib/server/queries";
import { executeCommand } from "@/lib/server/commands";
import { commandSchema } from "@/lib/server/validation";
import { ensure, errorResponse } from "@/lib/server/errors";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const admin = await apiAdmin();
    return Response.json(await loadState(admin.user.id), {
      headers: privateHeaders,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const admin = await apiAdmin();
    ensure(
      request.headers.get("origin") === new URL(env.BETTER_AUTH_URL).origin,
      "Asal permintaan tidak diizinkan.",
      403,
    );
    ensure(
      request.headers.get("content-type")?.includes("application/json"),
      "Gunakan JSON untuk permintaan.",
      415,
    );
    const body = await request.text();
    ensure(
      Buffer.byteLength(body, "utf8") <= 64_000,
      "Permintaan terlalu besar.",
      413,
    );
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      return Response.json(
        { error: "JSON tidak valid." },
        { status: 400, headers: privateHeaders },
      );
    }
    const cmd = commandSchema.parse(raw);
    const result = await executeCommand(admin.user.id, cmd);
    return Response.json(
      {
        result,
        state:
          "reauthenticate" in result && result.reauthenticate
            ? null
            : await loadState(admin.user.id),
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error: `Periksa isian: ${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
        },
        { status: 422, headers: privateHeaders },
      );
    return errorResponse(error);
  }
}
