import { loadPublicData } from "@/lib/server/queries";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(await loadPublicData(), {
    headers: { "Cache-Control": "no-store" },
  });
}
