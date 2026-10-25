"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Users,
  Beef,
  Wallet,
  CircleDollarSign,
  CalendarDays,
  ArrowRight,
  Clock3,
  UserPlus,
} from "lucide-react";
import { useQurban } from "./demo-provider";
import { useMobile } from "@/hooks/use-mobile";
import { MobileDashboard } from "./mobile-dashboard";
import {
  Badge,
  PageHeading,
  Panel,
  Progress,
  Stat,
  EmptyState,
  Notice,
} from "./ui";
import { Button } from "@/components/ui/button";
import {
  balanceOf,
  dateLabel,
  groupLabels,
  money,
  shortMoney,
  totals,
} from "@/lib/qurban-demo";

export function DashboardView() {
  const mobile = useMobile();
  const { state, periodId, base } = useQurban();
  const period = state.periods.find((p) => p.id === periodId)!;
  const data = totals(state, periodId);
  const percentage = data.obligation
    ? Math.round((data.net / data.obligation) * 100)
    : 0;
  const start = new Date(`${period.start.slice(0, 7)}-01T12:00:00Z`);
  const end = new Date(`${period.due.slice(0, 7)}-01T12:00:00Z`);
  const monthCount = Math.max(
    1,
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      end.getUTCMonth() -
      start.getUTCMonth() +
      1,
  );
  const months = Array.from({ length: monthCount }, (_, i) => {
    const month = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
    );
    return {
      key: month.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("id-ID", {
        month: "short",
        timeZone: "UTC",
      }).format(month),
    };
  });
  const values = months.map((month) =>
    data.entries
      .filter((entry) => entry.date.slice(0, 7) === month.key)
      .reduce(
        (sum, entry) =>
          sum + (entry.type === "deposit" ? entry.amount : -entry.amount),
        0,
      ),
  );
  const max = Math.max(...values, 1);
  const recent = [...data.entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  if (mobile) return <MobileDashboard />;
  return (
    <>
      <PageHeading
        title={`Assalamu’alaikum, Pak ${state.accounts[0].name.split(/\s+/)[0]}`}
        description="Mari jaga amanah dan wujudkan niat baik jamaah hari ini."
        action={
          <Button asChild className="q-primary-button">
            <Link href={`${base}/iuran?baru=1`}>
              <Plus size={17} /> Catat setoran
            </Link>
          </Button>
        }
      />
      <div className="q-welcome">
        <div>
          <span className="q-eyebrow">BERSAMA MENJADI KEBAIKAN</span>
          <h2>
            Selangkah lebih dekat
            <br />
            menuju qurban tahun ini.
          </h2>
          <p>
            {period.name} · Rencana pelaksanaan {dateLabel(period.date)}
          </p>
          <Link href={`${base}/periode`}>
            Kelola periode <ArrowRight size={16} />
          </Link>
        </div>
        <div className="q-welcome-progress">
          <div
            className="q-progress-ring"
            style={
              {
                "--progress": `${Math.min(percentage, 100)}%`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>
                {percentage}
                <small>%</small>
              </strong>
              <span>Iuran terkumpul</span>
            </div>
          </div>
          <p>
            {shortMoney(data.net)}{" "}
            <span>dari {shortMoney(data.obligation)}</span>
          </p>
        </div>
      </div>
      <div className="q-stat-grid">
        <Stat
          label="Jamaah terdaftar"
          value={data.participants.length}
          detail={`${data.waiting} jamaah dalam daftar tunggu`}
          icon={<Users size={19} />}
        />
        <Stat
          label="Sapi direncanakan"
          value={
            <>
              {data.groups.length}
              <small> ekor</small>
            </>
          }
          detail={`${data.groups.filter((g) => ["ready", "purchased", "slaughtered"].includes(g.status)).length} sapi sudah didanai`}
          icon={<Beef size={19} />}
        />
        <Stat
          label="Setoran bersih"
          value={shortMoney(data.net)}
          detail={`Dari ${data.entries.length} transaksi valid`}
          icon={<Wallet size={19} />}
          featured
        />
        <Stat
          label="Sisa kewajiban"
          value={shortMoney(data.remaining)}
          detail={`${data.paid} dari ${data.participants.filter((p) => p.groupId).length} jamaah lunas`}
          icon={<CircleDollarSign size={19} />}
        />
      </div>
      <div className="q-dashboard-middle">
        <Panel
          title="Perkembangan iuran"
          description="Setoran bersih per bulan pada periode terpilih"
          action={
            <span className="q-chart-legend">
              <i />
              Iuran tunai
            </span>
          }
        >
          <div className="q-chart">
            <div className="q-chart-y">
              <span>{shortMoney(max)}</span>
              <span>{shortMoney(max / 2)}</span>
              <span>Rp0</span>
            </div>
            <div className="q-chart-plot">
              <div className="q-chart-grid">
                <i />
                <i />
                <i />
              </div>
              <div
                className="q-chart-bars"
                style={{
                  gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
                }}
              >
                {months.map((month, i) => (
                  <div key={month.key} className="q-chart-column">
                    <div className="q-bar-space">
                      <div
                        className={`q-chart-bar ${values[i] ? "has-value" : ""}`}
                        style={{
                          height: `${Math.max((values[i] / max) * 100, 2)}%`,
                        }}
                        title={`${month.key}: ${money(values[i])}`}
                      />
                    </div>
                    <span>{month.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="q-chart-footer">
            <span>
              Total setoran masuk <strong>{money(data.deposits)}</strong>
            </span>
            <span>
              Pengembalian <strong>{money(data.refunds)}</strong>
            </span>
          </div>
        </Panel>
        <Panel
          title="Agenda periode"
          description="Tanggal yang perlu diperhatikan"
        >
          <div className="q-agenda">
            {[
              {
                title: "Pendaftaran jamaah",
                date: period.end,
                detail: "Batas penerimaan peserta",
                icon: UserPlus,
              },
              {
                title: "Pelunasan iuran",
                date: period.due,
                detail: "Selesaikan kewajiban jamaah",
                icon: Wallet,
              },
              {
                title: "Pelaksanaan qurban",
                date: period.date,
                detail: "Rencana jadwal panitia",
                icon: CalendarDays,
              },
            ].map((item) => (
              <div className="q-agenda-item" key={item.title}>
                <span className="q-agenda-icon">
                  <item.icon size={19} />
                </span>
                <div>
                  <small>{item.title}</small>
                  <strong>{dateLabel(item.date)}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="q-agenda-note">
            <Clock3 size={15} />
            Jadwal pelaksanaan dapat diperbarui panitia.
          </div>
        </Panel>
      </div>
      <div className="q-dashboard-bottom">
        <Panel
          title="Setoran terbaru"
          description="Penerimaan tunai yang telah dicatat"
          action={
            <Link href={`${base}/iuran`} className="q-small-link">
              Lihat semua <ArrowUpRight size={14} />
            </Link>
          }
        >
          <div className="q-table-scroll">
            <table className="q-table">
              <thead>
                <tr>
                  <th>Peserta</th>
                  <th>Tanggal</th>
                  <th>Nominal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((entry) => {
                  const participant = state.participants.find(
                    (p) => p.id === entry.participantId,
                  )!;
                  return (
                    <tr key={entry.id}>
                      <td>
                        <strong>{participant.name}</strong>
                        <small>{entry.receipt}</small>
                      </td>
                      <td>{dateLabel(entry.date, true)}</td>
                      <td className="q-money">{money(entry.amount)}</td>
                      <td>
                        <Link
                          href={`${base}/iuran/${entry.id}`}
                          aria-label={`Lihat kuitansi ${entry.receipt}`}
                          className="q-row-arrow"
                        >
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!recent.length && (
              <EmptyState description="Belum ada transaksi pada periode ini." />
            )}
          </div>
        </Panel>
        <Panel
          title="Kelompok sapi"
          description="Progres kelompok pada periode ini"
          action={
            <Link href={`${base}/kelompok`} className="q-small-link">
              Semua <ArrowUpRight size={14} />
            </Link>
          }
        >
          <div className="q-group-summary">
            {data.groups.map((group) => {
              const members = data.participants.filter(
                (p) => p.groupId === group.id,
              );
              const net = members.reduce(
                (sum, p) => sum + balanceOf(p.id, state.transactions),
                0,
              );
              const target = group.locked ? group.final : group.estimate;
              return (
                <Link
                  href={`${base}/kelompok/${group.id}`}
                  key={group.id}
                  className="q-mini-group"
                >
                  <div>
                    <span className="q-cow-icon">
                      <Beef size={20} />
                    </span>
                    <div>
                      <strong>{group.name}</strong>
                      <small>
                        {members.length}/{group.expected} anggota
                      </small>
                    </div>
                    <Badge>{groupLabels[group.status]}</Badge>
                  </div>
                  <Progress
                    value={(net / target) * 100}
                    label={`Iuran ${group.name}`}
                  />
                  <p>
                    <span>{shortMoney(net)} terkumpul</span>
                    <strong>{Math.round((net / target) * 100)}%</strong>
                  </p>
                </Link>
              );
            })}
            {!data.groups.length && (
              <EmptyState description="Belum ada kelompok pada periode ini." />
            )}
          </div>
        </Panel>
      </div>
      <Notice>
        Setoran bersih adalah total iuran dikurangi pengembalian, bukan saldo
        kas panitia yang tersedia.
      </Notice>
    </>
  );
}
