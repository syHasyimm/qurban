"use client";

import { DashboardView } from "./dashboard";
import { ParticipantsView } from "./participants";
import { GroupsView } from "./groups";
import { CashView } from "./cash";
import { PeriodsView } from "./periods";
import { ReportsView } from "./reports";
import { AccountsView, ActivityView, PublicSettingsView } from "./settings";
import type { Section } from "@/lib/qurban-demo";
import { useQurban } from "./demo-provider";
import { EmptyState, Panel } from "./ui";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function QurbanPage({
  section,
  id,
  initiallyOpen = false,
}: {
  section: Section;
  id?: string;
  initiallyOpen?: boolean;
}) {
  const { state, base, periodId } = useQurban();
  if (
    !state.periods.length &&
    !["periode", "informasi-publik", "akun-panitia", "aktivitas"].includes(
      section,
    )
  )
    return (
      <Panel>
        <EmptyState
          title="Mulai dari periode qurban pertama"
          description="Siapkan informasi panitia, lalu buat periode beserta jadwal untuk mulai mencatat jamaah dan iuran."
          action={
            <Button asChild>
              <Link href={`${base}/periode`}>Buat periode pertama</Link>
            </Button>
          }
        />
      </Panel>
    );
  switch (section) {
    case "dashboard":
      return <DashboardView />;
    case "periode":
      return <PeriodsView />;
    case "peserta":
      return <ParticipantsView key={periodId} id={id} />;
    case "kelompok":
      return <GroupsView key={periodId} id={id} />;
    case "iuran":
      return <CashView key={periodId} id={id} initiallyOpen={initiallyOpen} />;
    case "laporan":
      return <ReportsView />;
    case "informasi-publik":
      return <PublicSettingsView />;
    case "akun-panitia":
      return <AccountsView />;
    case "aktivitas":
      return <ActivityView />;
  }
}
