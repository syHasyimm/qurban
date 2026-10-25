import { requireAdmin } from "@/lib/session";
import { loadState } from "@/lib/server/queries";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const state = await loadState(admin.user.id);
  return <DashboardShell initialState={state}>{children}</DashboardShell>;
}
