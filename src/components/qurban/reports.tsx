"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download,
  Printer,
  ArrowDownLeft,
  Undo2,
  Wallet,
  CircleDollarSign,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQurban } from "./demo-provider";
import { MobileActions } from "./mobile-controls";
import { MonthlyContributions } from "./monthly-contributions";
import { Badge, EmptyState, Notice, PageHeading, Panel, Stat } from "./ui";
import {
  balanceOf,
  dateLabel,
  exportCsv,
  groupLabels,
  money,
  paymentStatus,
  shortMoney,
  targetOf,
  totals,
} from "@/lib/qurban-demo";

export function ReportsView() {
  const { state, periodId, base, preview } = useQurban();
  const [tab, setTab] = useState("Ringkasan");
  const data = totals(state, periodId);
  const period = state.periods.find((p) => p.id === periodId)!;
  const groups = state.groups.filter((g) => g.periodId === periodId);
  const rounding = groups
    .filter((g) => g.locked && g.status !== "cancelled")
    .reduce((n, g) => n + targetOf(g) * g.expected - g.final, 0);
  const purchaseTotal = groups.reduce((n, g) => n + g.purchaseCost, 0);
  const participantRows = data.participants.map((p) => {
    const g = groups.find((g) => g.id === p.groupId);
    const net = balanceOf(p.id, state.transactions);
    return [
      p.number,
      p.name,
      g?.name ?? "Daftar tunggu",
      targetOf(g),
      net,
      Math.max(targetOf(g) - net, 0),
      Math.max(net - targetOf(g), 0),
      paymentStatus(p, groups, state.transactions),
    ];
  });
  function downloadCsv(filename: string, rows: (string | number)[][]) {
    exportCsv(
      filename,
      preview
        ? [["DATA CONTOH", "Bukan laporan keuangan nyata"], ...rows]
        : rows,
    );
  }
  function download() {
    if (tab === "Peserta")
      downloadCsv(`laporan-peserta-${periodId}.csv`, [
        [
          "Nomor",
          "Nama",
          "Kelompok",
          "Target",
          "Setoran bersih",
          "Sisa",
          "Kelebihan",
          "Status",
        ],
        ...participantRows,
      ]);
    else if (tab === "Kelompok")
      downloadCsv(`laporan-kelompok-${periodId}.csv`, [
        [
          "Kelompok",
          "Anggota",
          "Target per peserta",
          "Biaya final",
          "Harga beli",
          "Status",
        ],
        ...groups.map((g) => [
          g.name,
          data.participants.filter((p) => p.groupId === g.id).length,
          targetOf(g),
          g.final,
          g.purchaseCost,
          groupLabels[g.status],
        ]),
      ]);
    else if (tab === "Transaksi")
      downloadCsv(`laporan-transaksi-${periodId}.csv`, [
        ["Kuitansi", "Tanggal", "Jenis", "Nominal", "Petugas"],
        ...data.entries.map((t) => [
          t.receipt,
          t.date,
          t.type,
          t.amount,
          t.officer,
        ]),
      ]);
    else
      downloadCsv(`ringkasan-${periodId}.csv`, [
        ["Laporan", period.name],
        ["Setoran valid", data.deposits],
        ["Pengembalian valid", data.refunds],
        ["Setoran bersih", data.net],
        ["Kewajiban peserta", data.obligation],
        ["Sisa kewajiban", data.remaining],
        ["Pembelian sapi", purchaseTotal],
        ["Pembulatan kelompok", rounding],
      ]);
  }
  return (
    <>
      <PageHeading
        title="Laporan"
        description={`Rekap kepesertaan dan keuangan ${period.name}.`}
        action={
          <MobileActions
            title="Ekspor laporan"
            description={`${tab} · ${period.name}. Data mencakup seluruh periode pada kategori ini${preview ? " dan merupakan data contoh" : ""}.`}
          >
            <Button variant="outline" onClick={download}>
              <Download size={16} /> Ekspor CSV
            </Button>
            <Button className="q-primary-button" onClick={() => window.print()}>
              <Printer size={16} /> Cetak laporan
            </Button>
          </MobileActions>
        }
      />
      {preview && (
        <p className="q-print-only">
          LAPORAN CONTOH · Pratinjau frontend · Bukan laporan keuangan nyata
        </p>
      )}
      <div className="q-stat-grid">
        <Stat
          label="Setoran valid"
          value={shortMoney(data.deposits)}
          detail="Total penerimaan tunai"
          icon={<ArrowDownLeft size={19} />}
        />
        <Stat
          label="Pengembalian valid"
          value={shortMoney(data.refunds)}
          detail="Total pengembalian tunai"
          icon={<Undo2 size={19} />}
        />
        <Stat
          label="Setoran bersih"
          value={shortMoney(data.net)}
          detail="Bukan saldo kas tersedia"
          icon={<Wallet size={19} />}
          featured
        />
        <Stat
          label="Sisa kewajiban"
          value={shortMoney(data.remaining)}
          detail="Dihitung untuk setiap peserta"
          icon={<CircleDollarSign size={19} />}
        />
      </div>
      <Panel>
        <div className="q-tabs q-report-tabs">
          {["Ringkasan", "Peserta", "Kelompok", "Transaksi"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={tab === item ? "is-active" : ""}
            >
              {item}
            </button>
          ))}
        </div>
        {tab === "Ringkasan" ? (
          <div className="q-report-summary">
            <div>
              <h2>Rekonsiliasi iuran</h2>
              <p>
                {period.name} · Rencana {dateLabel(period.date)}
              </p>
              <dl className="q-definition">
                <div>
                  <dt>Total kewajiban peserta</dt>
                  <dd>{money(data.obligation)}</dd>
                </div>
                <div>
                  <dt>Total setoran valid</dt>
                  <dd>{money(data.deposits)}</dd>
                </div>
                <div>
                  <dt>Total pengembalian valid</dt>
                  <dd>({money(data.refunds)})</dd>
                </div>
                <div className="q-report-total">
                  <dt>Setoran bersih</dt>
                  <dd>{money(data.net)}</dd>
                </div>
                <div>
                  <dt>Sisa kewajiban peserta</dt>
                  <dd>{money(data.remaining)}</dd>
                </div>
                <div>
                  <dt>Kelebihan belum dikembalikan</dt>
                  <dd>
                    {money(
                      data.participants.reduce(
                        (n, p) =>
                          n +
                          Math.max(
                            balanceOf(p.id, state.transactions) -
                              targetOf(groups.find((g) => g.id === p.groupId)),
                            0,
                          ),
                        0,
                      ),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Total harga beli sapi</dt>
                  <dd>{money(purchaseTotal)}</dd>
                </div>
                <div>
                  <dt>Selisih pembulatan kelompok final</dt>
                  <dd>{money(rounding)}</dd>
                </div>
              </dl>
            </div>
            <div className="q-report-overview">
              <div className="qm-mobile-only">
                <MonthlyContributions />
              </div>
              <h3>Perkembangan pelaksanaan</h3>
              {[
                { label: "Jamaah terdaftar", value: data.participants.length },
                {
                  label: "Jamaah mendapat kelompok",
                  value: data.participants.length - data.waiting,
                },
                { label: "Sapi direncanakan", value: data.groups.length },
                {
                  label: "Sapi sudah didanai",
                  value: data.groups.filter((g) =>
                    ["ready", "purchased", "slaughtered"].includes(g.status),
                  ).length,
                },
                {
                  label: "Sapi sudah dibeli",
                  value: data.groups.filter((g) =>
                    ["purchased", "slaughtered"].includes(g.status),
                  ).length,
                },
                {
                  label: "Sapi sudah dikurbankan",
                  value: data.groups.filter((g) => g.status === "slaughtered")
                    .length,
                },
              ].map((row) => (
                <div key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
              <Notice>
                Selisih pembulatan harus disepakati penggunaannya dan tidak
                otomatis menjadi pendapatan panitia.
              </Notice>
            </div>
          </div>
        ) : (
          <div className="q-table-scroll">
            <table className="q-table">
              <thead>
                <tr>
                  {(tab === "Peserta"
                    ? [
                        "Peserta",
                        "Kelompok",
                        "Target",
                        "Setoran bersih",
                        "Sisa",
                        "Status",
                      ]
                    : tab === "Kelompok"
                      ? [
                          "Kelompok",
                          "Anggota",
                          "Target / anggota",
                          "Harga beli",
                          "Status",
                        ]
                      : ["Kuitansi", "Tanggal", "Jenis", "Nominal", "Petugas"]
                  ).map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tab === "Peserta"
                  ? data.participants.map((p) => {
                      const g = groups.find((g) => g.id === p.groupId);
                      const net = balanceOf(p.id, state.transactions);
                      return (
                        <tr key={p.id}>
                          <td>
                            <Link href={`${base}/peserta/${p.id}`}>
                              <strong>{p.name}</strong>
                              <small>{p.number}</small>
                            </Link>
                          </td>
                          <td>{g?.name ?? "Daftar tunggu"}</td>
                          <td>{money(targetOf(g))}</td>
                          <td>{money(net)}</td>
                          <td>{money(Math.max(targetOf(g) - net, 0))}</td>
                          <td>
                            <Badge>
                              {paymentStatus(p, groups, state.transactions)}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  : tab === "Kelompok"
                    ? groups.map((g) => (
                        <tr key={g.id}>
                          <td>
                            <Link href={`${base}/kelompok/${g.id}`}>
                              <strong>
                                {g.name}
                                <ArrowUpRight
                                  size={12}
                                  className="inline ml-1"
                                />
                              </strong>
                              <small>{g.breed}</small>
                            </Link>
                          </td>
                          <td>
                            {
                              data.participants.filter(
                                (p) => p.groupId === g.id,
                              ).length
                            }
                            /{g.expected}
                          </td>
                          <td>{money(targetOf(g))}</td>
                          <td>{money(g.purchaseCost)}</td>
                          <td>
                            <Badge>{groupLabels[g.status]}</Badge>
                          </td>
                        </tr>
                      ))
                    : data.entries.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <Link href={`${base}/iuran/${t.id}`}>
                              {t.receipt}
                            </Link>
                          </td>
                          <td>{dateLabel(t.date, true)}</td>
                          <td>
                            <Badge>
                              {t.type === "deposit"
                                ? "Setoran"
                                : "Pengembalian"}
                            </Badge>
                          </td>
                          <td>{money(t.amount)}</td>
                          <td>{t.officer}</td>
                        </tr>
                      ))}
              </tbody>
            </table>
            {!(tab === "Kelompok"
              ? groups.length
              : tab === "Peserta"
                ? data.participants.length
                : data.entries.length) && (
              <EmptyState description="Belum ada data laporan pada periode ini." />
            )}
          </div>
        )}
      </Panel>
      <Notice>
        Laporan ini mencakup iuran, pengembalian, kewajiban, dan pembelian sapi.
        Buku kas pengeluaran operasional belum termasuk. Cetakan dan ekspor
        {preview
          ? "menggunakan data contoh pratinjau."
          : "menggunakan data tersimpan pada periode yang dipilih."}
      </Notice>
    </>
  );
}
