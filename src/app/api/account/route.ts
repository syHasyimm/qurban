import { getSession, getActiveAdmin } from "@/lib/session";
import type { AccountSummary } from "@/lib/types";

export async function GET() {
  const session = await getSession();
  const headers = { "Cache-Control": "private, no-store" };
  if (!session)
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  if (!(await getActiveAdmin()))
    return Response.json({ error: "FORBIDDEN" }, { status: 403, headers });
  const account: AccountSummary = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    createdAt: session.user.createdAt.toISOString(),
    sessionExpiresAt: session.session.expiresAt.toISOString(),
  };
  return Response.json(account, { headers });
}
