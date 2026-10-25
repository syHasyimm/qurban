import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { apiAdmin } from "@/lib/session";
import { errorResponse } from "@/lib/server/errors";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);
export async function GET(request: Request) {
  const path = new URL(request.url).pathname.replace("/api/auth", "");
  if (!["/get-session", "/error", "/ok"].includes(path)) {
    try {
      await apiAdmin();
    } catch (error) {
      return errorResponse(error);
    }
  }
  return handlers.GET(request);
}
export async function POST(request: Request) {
  const path = new URL(request.url).pathname.replace("/api/auth", "");
  if (path.startsWith("/sign-up"))
    return Response.json(
      { error: "Pendaftaran akun publik dinonaktifkan." },
      { status: 403 },
    );
  if (!["/sign-in/email", "/sign-out"].includes(path)) {
    try {
      await apiAdmin();
    } catch (error) {
      return errorResponse(error);
    }
  }
  return handlers.POST(request);
}
