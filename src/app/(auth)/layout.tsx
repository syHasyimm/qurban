import { redirect } from "next/navigation";
import { getActiveAdmin } from "@/lib/session";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await getActiveAdmin()) redirect("/dashboard");
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-5 py-12 sm:py-16"
      >
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
