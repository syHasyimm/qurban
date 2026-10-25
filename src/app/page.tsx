import { connection } from "next/server";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { PublicContent } from "@/components/qurban/public-content";
import { loadPublicData } from "@/lib/server/queries";

export default async function HomePage() {
  await connection();
  const data = await loadPublicData();
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <PublicContent {...data} />
      </main>
      <SiteFooter />
    </>
  );
}
