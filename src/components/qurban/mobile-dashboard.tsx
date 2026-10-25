"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Beef,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  Eye,
  EyeOff,
  HandCoins,
  Info,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { useQurban } from "./demo-provider";
import { Badge, EmptyState, Progress } from "./ui";
import {
  balanceOf,
  dateLabel,
  groupLabels,
  money,
  totals,
} from "@/lib/qurban-demo";

export function MobileDashboard() {
  const { state, periodId, base } = useQurban();
  const [hidden, setHidden] = useState(false);
  const period = state.periods.find((p) => p.id === periodId)!;
  const data = totals(state, periodId);
  const percentage = data.obligation
    ? Math.round((data.net / data.obligation) * 100)
    : 0;
  const recent = [...data.entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  return (
    <div className="qm-dashboard">
      <section className="qm-balance" aria-label="Ringkasan iuran">
        <div className="qm-balance-label">
          <span>Setoran bersih</span>
          <button
            onClick={() => setHidden(!hidden)}
            aria-label={hidden ? "Tampilkan nominal" : "Sembunyikan nominal"}
            aria-pressed={hidden}
          >
            {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
        <h1 className="sr-only">
          Assalamu’alaikum, Pak {state.accounts[0].name.split(/\s+/)[0]}
        </h1>
        <strong className="qm-balance-number">
          {hidden ? "Rp ••••••••" : money(data.net)}
        </strong>
        <div className="qm-balance-progress">
          <Progress value={percentage} label="Persentase iuran terkumpul" />
          <span>{percentage}%</span>
        </div>
        <p>dari kewajiban {hidden ? "Rp ••••••" : money(data.obligation)}</p>
        <div className="qm-balance-bottom">
          <span>Sisa kewajiban</span>
          <strong>{hidden ? "Rp ••••••" : money(data.remaining)}</strong>
        </div>
      </section>
      <div className="qm-quick-actions">
        {[
          { href: "/iuran?baru=1", label: "Setor tunai", icon: HandCoins },
          { href: "/peserta", label: "Peserta", icon: Users },
          { href: "/kelompok", label: "Kelompok", icon: Beef },
          { href: "/laporan", label: "Laporan", icon: ChartNoAxesCombined },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={label} href={`${base}${href}`}>
            <span>
              <Icon size={23} strokeWidth={1.7} />
            </span>
            {label}
          </Link>
        ))}
      </div>
      <div className="qm-stat-strip">
        <Link href={`${base}/peserta`}>
          <strong>{data.participants.length}</strong>
          <span>Peserta aktif</span>
        </Link>
        <Link href={`${base}/kelompok`}>
          <strong>
            {data.groups.length}
            <small> ekor</small>
          </strong>
          <span>Sapi qurban</span>
        </Link>
        <Link href={`${base}/laporan`}>
          <strong>
            {data.paid}
            <small>/{data.participants.length - data.waiting}</small>
          </strong>
          <span>Sudah lunas</span>
        </Link>
      </div>
      <section className="qm-follow-up">
        <div className="qm-section-heading">
          <h2>Perlu ditindaklanjuti</h2>
          <span className="qm-small-dot" />
        </div>
        <div className="qm-follow-up-list">
          {data.waiting > 0 && (
            <Link href={`${base}/peserta?filter=menunggu`}>
              <span className="qm-action-icon">
                <UserRoundPlus size={20} />
              </span>
              <span>
                <strong>{data.waiting} peserta belum berkelompok</strong>
                <small>Tempatkan agar dapat mulai mencicil</small>
              </span>
              <ChevronRight size={18} />
            </Link>
          )}
          <Link href={`${base}/periode`}>
            <span className="qm-action-icon">
              <CalendarDays size={20} />
            </span>
            <span>
              <strong>
                {period.status === "draft"
                  ? "Siapkan periode qurban"
                  : "Batas pelunasan iuran"}
              </strong>
              <small>
                {dateLabel(period.due)} · {period.name}
              </small>
            </span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>
      <section className="qm-recent">
        <div className="qm-section-heading">
          <h2>Transaksi terbaru</h2>
          <Link href={`${base}/iuran`}>
            Lihat semua <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="qm-flat-list">
          {recent.map((entry) => {
            const person = state.participants.find(
              (p) => p.id === entry.participantId,
            );
            return (
              <Link
                href={`${base}/iuran/${entry.id}`}
                className="qm-transaction-row"
                key={entry.id}
              >
                <span
                  className={`qm-action-icon ${entry.type === "refund" ? "is-refund" : ""}`}
                >
                  <ArrowDownLeft size={20} />
                </span>
                <span className="qm-row-copy">
                  <strong>{person?.name}</strong>
                  <small>
                    {entry.type === "deposit" ? "Setoran" : "Pengembalian"} ·{" "}
                    {dateLabel(entry.date, true)}
                  </small>
                </span>
                <span className="qm-row-amount">
                  <strong>
                    {hidden
                      ? "Rp ••••••"
                      : `${entry.type === "deposit" ? "+" : "−"}${money(entry.amount)}`}
                  </strong>
                  <small>Tunai</small>
                </span>
              </Link>
            );
          })}
          {!recent.length && (
            <EmptyState
              title="Belum ada setoran"
              description="Catat setelah uang tunai diterima panitia."
            />
          )}
        </div>
      </section>
      <section>
        <div className="qm-section-heading">
          <h2>Kelompok sapi</h2>
          <Link href={`${base}/kelompok`}>
            Lihat semua <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="qm-home-groups">
          {data.groups.slice(0, 2).map((group) => {
            const members = data.participants.filter(
              (p) => p.groupId === group.id,
            );
            const net = members.reduce(
              (sum, p) => sum + balanceOf(p.id, state.transactions),
              0,
            );
            const target = group.locked ? group.final : group.estimate;
            return (
              <Link key={group.id} href={`${base}/kelompok/${group.id}`}>
                <div>
                  <span className="qm-action-icon">
                    <Beef size={21} />
                  </span>
                  <span>
                    <strong>{group.name}</strong>
                    <small>
                      {members.length}/{group.expected} anggota
                    </small>
                  </span>
                  <Badge>{groupLabels[group.status]}</Badge>
                </div>
                <Progress
                  value={target ? (net / target) * 100 : 0}
                  label={`Iuran ${group.name}`}
                />
              </Link>
            );
          })}
          {!data.groups.length && (
            <Link href={`${base}/kelompok`} className="qm-empty-link">
              Buat kelompok sapi pertama <ChevronRight size={17} />
            </Link>
          )}
        </div>
      </section>
      <p className="qm-finance-note">
        <Info size={15} />
        Setoran bersih adalah iuran dikurangi pengembalian, bukan saldo kas
        tersedia.
      </p>
    </div>
  );
}
