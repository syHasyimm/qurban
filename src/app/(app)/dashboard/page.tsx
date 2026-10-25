import type { Metadata } from "next";
import { QurbanPage } from "@/components/qurban/page-content";
import { requireAdmin } from "@/lib/session";
export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};
export default async function DashboardPage() {
  await requireAdmin();
  return <QurbanPage section="dashboard" />;
}
