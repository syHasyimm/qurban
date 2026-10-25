import type { Metadata } from "next";
import { DashboardShell } from "@/components/shared/dashboard-shell";
export const metadata: Metadata = {
  title: "Pratinjau Frontend",
  robots: { index: false, follow: false },
};
export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell preview>{children}</DashboardShell>;
}
