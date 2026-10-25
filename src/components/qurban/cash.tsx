"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMobile } from "@/hooks/use-mobile";
import { MobileActions } from "./mobile-controls";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeft,
  Download,
  Plus,
  Wallet,
  ReceiptText,
  Undo2,
  Printer,
  Ban,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQurban, useViewState } from "./demo-provider";
import {
  Badge,
  Editor,
  EmptyState,
  Notice,
  PageHeading,
  Panel,
  SearchBox,
  Stat,
  type EditorConfig,
} from "./ui";
import {
  balanceOf,
  dateLabel,
  exportCsv,
  money,
  shortMoney,
  targetOf,
  totals,
  type CashEntry,
  type DemoState,
} from "@/lib/qurban-demo";

function reconcileGroups(state: DemoState, transactions: CashEntry[]) {
  return state.groups.map((g) => {
    if (!g.locked || !["collecting", "ready"].includes(g.status)) return g;
    const members = state.participants.filter(
      (p) => p.active && p.groupId === g.id,
    );
    const ready =
      members.length === g.expected &&
      members.every((p) => balanceOf(p.id, transactions) === targetOf(g));
    return {
      ...g,
      status: ready ? ("ready" as const) : ("collecting" as const),
    };
  });
}
export function CashView({
  id,
  initiallyOpen = false,
}: {
  id?: string;
  initiallyOpen?: boolean;
}) {
  const { state, setState, periodId, base, audit, preview, mutate } =
    useQurban();
  const params = useSearchParams();
  const router = useRouter();
  const mobile = useMobile();
  const createdReceipt = useRef<string | undefined>(undefined);
  const [search, setSearch] = useViewState("iuran", "search", "");
  const [filter, setFilter] = useViewState("iuran", "filter", "all");
  const [page, setPage] = useViewState("iuran", "page", 1);
  const [editor, setEditor] = useState<EditorConfig | null>(() =>
    initiallyOpen
      ? makeCashEditor(params.get("jenis") === "refund" ? "refund" : "deposit")
      : null,
  );
  const period = state.periods.find((p) => p.id === periodId)!;
  const readOnly = ["completed", "archived"].includes(period.status);
  const data = totals(state, periodId);
  function closeEditor() {
    setEditor(null);
    if (initiallyOpen) {
      const origin = params.get("kembali");
      const safeOrigin =
        origin &&
        /^\/(dashboard|peserta|iuran|kelompok)(\/[\w-]+)?$/.test(origin)
          ? origin
          : "/iuran";
      router.replace(`${base}${safeOrigin}`, { scroll: false });
    }
  }
  function makeCashEditor(type: "deposit" | "refund"): EditorConfig {
    const selectedPeriod = state.periods.find((p) => p.id === periodId)!;
    const candidates = state.participants.filter(
      (p) =>
        p.periodId === periodId &&
        p.active &&
        p.groupId &&
        state.groups.find((g) => g.id === p.groupId)?.status !== "cancelled" &&
        (type === "refund"
          ? balanceOf(p.id, state.transactions) > 0
          : targetOf(state.groups.find((g) => g.id === p.groupId)) >
            balanceOf(p.id, state.transactions)),
    );
    return {
      cash: { type, receiptId: () => createdReceipt.current },
      title:
        type === "deposit" ? "Catat setoran tunai" : "Catat pengembalian tunai",
      description:
        type === "deposit"
          ? "Catat setelah uang tunai benar-benar diterima oleh panitia."
          : "Gunakan pengembalian hanya saat uang benar-benar diserahkan kembali kepada jamaah.",
      fields: [
        {
          name: "participant",
          label: "Peserta dan sisa kewajiban",
          value: candidates.some((p) => p.id === params.get("peserta"))
            ? params.get("peserta")!
            : "",
          options: [
            { value: "", label: "Pilih peserta…" },
            ...candidates.map((p) => ({
              value: p.id,
              label: `${p.number} · ${p.name} · ${money(type === "refund" ? balanceOf(p.id, state.transactions) : Math.max(targetOf(state.groups.find((g) => g.id === p.groupId)) - balanceOf(p.id, state.transactions), 0))}`,
            })),
          ],
        },
        { name: "amount", label: "Nominal tunai (Rp)", type: "number", min: 1 },
        {
          name: "date",
          label: "Tanggal serah terima",
          type: "date",
          value: preview
            ? "2026-10-25"
            : new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Jakarta",
              }).format(new Date()),
        },
        {
          name: "time",
          label: "Waktu serah terima (WIB)",
          type: "time",
          value: new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(new Date()),
        },
        {
          name: "notes",
          label: type === "refund" ? "Alasan pengembalian" : "Catatan",
          type: "textarea",
          required: type === "refund",
        },
      ],
      submit: type === "deposit" ? "Simpan setoran" : "Simpan pengembalian",
      save: (v) => {
        if (!preview)
          return mutate(
            "cash.create",
            { ...v, type },
            undefined,
            periodId,
            (result) => {
              createdReceipt.current = result.id;
            },
          );
        if (["draft", "completed", "archived"].includes(selectedPeriod.status))
          return "Periode ini tidak menerima transaksi.";
        const participant = state.participants.find(
          (p) => p.id === v.participant && p.periodId === periodId && p.active,
        );
        if (!participant?.groupId)
          return "Pilih peserta aktif yang sudah mendapat kelompok.";
        const amount = Number(v.amount);
        if (!Number.isSafeInteger(amount) || amount <= 0)
          return "Nominal harus berupa rupiah utuh yang lebih besar dari nol.";
        if (v.date < selectedPeriod.start)
          return "Tanggal transaksi tidak boleh mendahului awal penerimaan iuran.";
        if (type === "deposit" && v.date > selectedPeriod.due)
          return "Tanggal setoran melewati batas pelunasan. Pengecualian memerlukan proses server tersendiri.";
        const net = balanceOf(participant.id, state.transactions);
        const group = state.groups.find((g) => g.id === participant.groupId);
        if (type === "deposit" && amount > Math.max(targetOf(group) - net, 0))
          return `Setoran melebihi sisa kewajiban ${money(Math.max(targetOf(group) - net, 0))}.`;
        if (type === "refund" && amount > net)
          return `Pengembalian melebihi setoran bersih ${money(net)}.`;
        if (
          type === "refund" &&
          group &&
          ["purchased", "slaughtered"].includes(group.status) &&
          net - amount < targetOf(group)
        )
          return "Pengembalian ini mengurangi pelunasan kelompok yang sudah dibeli. Koreksi lanjutan memerlukan layanan server.";
        const entry: CashEntry = {
          id: crypto.randomUUID(),
          receipt: `KWT-${selectedPeriod.year}-${String(state.transactions.length + 1).padStart(4, "0")}`,
          participantId: participant.id,
          type,
          amount,
          date: v.date,
          time: v.time,
          officer: state.accounts[0].name,
          notes: v.notes,
          voidReason: "",
        };
        setState((s) => {
          const transactions = [...s.transactions, entry];
          return {
            ...s,
            transactions,
            groups: reconcileGroups(s, transactions),
          };
        });
        createdReceipt.current = entry.id;
        audit(
          type === "deposit"
            ? "Setoran tunai dicatat"
            : "Pengembalian tunai dicatat",
          `${participant.name} · ${entry.receipt} · ${money(amount)}`,
          "Keuangan",
        );
        toast.success(
          `${type === "deposit" ? "Setoran" : "Pengembalian"} dicatat dalam pratinjau. Kuitansi tersedia di riwayat.`,
        );
      },
    };
  }
  function voidEntry(entry: CashEntry) {
    setEditor({
      title: "Void transaksi",
      description:
        "Untuk koreksi salah input. Riwayat tidak dihapus. Jika uang benar-benar dikembalikan, gunakan pengembalian tunai.",
      fields: [{ name: "reason", label: "Alasan void", type: "textarea" }],
      submit: "Void transaksi",
      save: (v) => {
        if (!preview) return mutate("cash.void", v, entry.id);
        if (v.reason.trim().length < 5)
          return "Alasan void minimal lima karakter.";
        const next = state.transactions.map((t) =>
          t.id === entry.id ? { ...t, voidReason: v.reason } : t,
        );
        if (balanceOf(entry.participantId, next) < 0)
          return "Void ditolak karena setoran bersih akan menjadi negatif. Periksa transaksi pengembalian terlebih dahulu.";
        const p = state.participants.find((p) => p.id === entry.participantId)!;
        const g = state.groups.find((g) => g.id === p.groupId);
        if (
          g &&
          ["purchased", "slaughtered"].includes(g.status) &&
          balanceOf(p.id, next) !== targetOf(g)
        )
          return "Koreksi ini mengubah pelunasan sapi yang sudah dibeli dan memerlukan penanganan server.";
        setState((s) => ({
          ...s,
          transactions: next,
          groups: reconcileGroups(s, next),
        }));
        audit(
          "Transaksi di-void",
          `${entry.receipt} · ${v.reason}`,
          "Keuangan",
        );
        toast.success("Transaksi di-void dalam pratinjau.");
      },
    });
  }
  function correct(entry: CashEntry) {
    const related = state.transactions.filter(
      (t) => t.participantId === entry.participantId && !t.voidReason,
    );
    setEditor({
      title: "Koreksi transaksi tunai",
      review: true,
      description:
        "Void dan transaksi pengganti disimpan sekaligus. Gunakan untuk salah input; uang yang benar-benar dikembalikan dicatat sebagai refund.",
      fields: [
        {
          name: "scope",
          label: "Transaksi yang di-void",
          value: "single",
          options: [
            { value: "single", label: `Kuitansi ini saja: ${entry.receipt}` },
            ...(related.length > 1 && related.length <= 20
              ? [
                  {
                    value: "all",
                    label: `Seluruh ${related.length} transaksi valid peserta ini, termasuk refund`,
                  },
                ]
              : []),
          ],
        },
        { name: "reason", label: "Alasan koreksi", type: "textarea" },
        {
          name: "amount",
          label: "Nominal transaksi pengganti (Rp)",
          type: "number",
          required: false,
          min: 1,
          help: "Kosongkan bila hanya melakukan koreksi void.",
        },
        {
          name: "type",
          label: "Jenis transaksi pengganti",
          options: [
            { value: "deposit", label: "Setoran" },
            { value: "refund", label: "Pengembalian" },
          ],
        },
        {
          name: "participant",
          label: "Peserta transaksi pengganti",
          required: false,
          value: entry.participantId,
          options: state.participants
            .filter((p) => p.periodId === periodId && p.active && p.groupId)
            .map((p) => ({ value: p.id, label: `${p.number} · ${p.name}` })),
        },
        {
          name: "date",
          label: "Tanggal transaksi pengganti",
          type: "date",
          value: entry.date,
        },
        {
          name: "time",
          label: "Waktu transaksi pengganti (WIB)",
          type: "time",
          value: entry.time ?? "12:00",
        },
      ],
      submit: "Simpan koreksi sekaligus",
      save: (v) =>
        mutate("cash.correct", {
          _requestId: v._requestId,
          ids: v.scope === "all" ? related.map((t) => t.id) : [entry.id],
          reason: v.reason,
          ...(v.amount
            ? {
                replacement: {
                  participant: v.participant,
                  type: v.type,
                  amount: Number(v.amount),
                  date: v.date,
                  time: v.time,
                  notes: v.reason,
                },
              }
            : {}),
        }),
    });
  }
  const entry = id
    ? state.transactions.find(
        (t) =>
          t.id === id &&
          state.participants.some(
            (p) => p.id === t.participantId && p.periodId === periodId,
          ),
      )
    : undefined;
  if (id && !entry)
    return (
      <>
        <PageHeading
          title="Kuitansi tidak ditemukan"
          description="Pilih periode yang sesuai atau buka kembali daftar transaksi."
        />
        <Button asChild variant="outline">
          <Link href={`${base}/iuran`}>Kembali ke iuran</Link>
        </Button>
      </>
    );
  if (entry) {
    const p = state.participants.find((p) => p.id === entry.participantId)!;
    const g = state.groups.find((g) => g.id === p.groupId);
    return (
      <>
        <Link className="q-back q-no-print" href={`${base}/iuran`}>
          <ArrowLeft size={15} /> Semua transaksi
        </Link>
        <PageHeading
          title="Kuitansi tunai"
          description="Bukti pencatatan penerimaan atau pengembalian uang tunai."
          action={
            <>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${entry.receipt}\n${p.name}\n${money(entry.amount)}\n${dateLabel(entry.date)}${preview ? "\nCONTOH KUITANSI · Bukan bukti transaksi nyata" : ""}`,
                    );
                    toast.success(
                      preview
                        ? "Ringkasan kuitansi contoh disalin."
                        : "Ringkasan kuitansi disalin.",
                    );
                  } catch {
                    toast.error(
                      "Browser tidak mengizinkan penyalinan. Gunakan cetak kuitansi.",
                    );
                  }
                }}
              >
                <Copy size={16} /> Salin
              </Button>
              <Button
                className="q-primary-button"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Cetak kuitansi
              </Button>
            </>
          }
        />
        <div className="q-receipt">
          <div className="q-receipt-head">
            <div className="q-receipt-brand">
              <Image src="/logo.png" width={58} height={58} alt="" />
              <div>
                <h2>Qurban.</h2>
                <p>{state.settings.name}</p>
              </div>
            </div>
            <Badge>
              {entry.voidReason
                ? "Void"
                : entry.type === "deposit"
                  ? "Setoran tunai"
                  : "Pengembalian tunai"}
            </Badge>
          </div>
          <div className="q-receipt-title">
            <span>
              KUITANSI{" "}
              {entry.type === "deposit" ? "PENERIMAAN" : "PENGEMBALIAN"}
            </span>
            <strong>{entry.receipt}</strong>
            <p>
              {dateLabel(entry.date)}
              {entry.time ? ` · ${entry.time} WIB` : ""}
            </p>
          </div>
          <div className="q-receipt-amount">
            <small>
              {entry.type === "deposit"
                ? "Telah diterima uang tunai sebesar"
                : "Telah dikembalikan uang tunai sebesar"}
            </small>
            <strong>{money(entry.amount)}</strong>
            <span>
              {entry.type === "deposit" ? "dari" : "kepada"} {p.name}
            </span>
          </div>
          <dl className="q-definition">
            <div>
              <dt>Nomor peserta</dt>
              <dd>{p.number}</dd>
            </div>
            <div>
              <dt>Keperluan</dt>
              <dd>
                {entry.type === "deposit"
                  ? "Iuran qurban"
                  : "Pengembalian iuran qurban"}{" "}
                · {period.name}
              </dd>
            </div>
            <div>
              <dt>Kelompok</dt>
              <dd>{g?.name ?? "Belum ditentukan"}</dd>
            </div>
            <div>
              <dt>Metode</dt>
              <dd>Tunai</dd>
            </div>
            <div>
              <dt>Catatan</dt>
              <dd>{entry.notes || "Tidak ada catatan"}</dd>
            </div>
            {entry.voidReason && (
              <div>
                <dt>Alasan void</dt>
                <dd className="q-danger">{entry.voidReason}</dd>
              </div>
            )}
          </dl>
          <div className="q-receipt-sign">
            <div>
              <span>{entry.type === "deposit" ? "Penyetor" : "Penerima"}</span>
              <strong>{p.name}</strong>
            </div>
            <div>
              <span>Petugas panitia</span>
              <strong>{entry.officer}</strong>
            </div>
          </div>
          {preview && (
            <div className="q-receipt-demo">
              CONTOH KUITANSI · Pratinjau frontend · Bukan bukti transaksi nyata
            </div>
          )}
        </div>
        {!readOnly && !entry.voidReason && (
          <div className="q-receipt-void q-no-print">
            <MobileActions
              title="Tindakan transaksi"
              description={`${entry.receipt} · Riwayat transaksi tetap tersimpan setelah koreksi.`}
              label="Tindakan transaksi"
              icon={false}
            >
              {!preview && (
                <Button variant="outline" onClick={() => correct(entry)}>
                  Koreksi sekaligus
                </Button>
              )}
              <Button variant="destructive" onClick={() => voidEntry(entry)}>
                <Ban size={15} /> Void transaksi ini
              </Button>
            </MobileActions>
          </div>
        )}
        <Editor config={editor} onClose={closeEditor} />
      </>
    );
  }
  const all = state.transactions.filter((t) =>
    state.participants.some(
      (p) => p.id === t.participantId && p.periodId === periodId,
    ),
  );
  const filtered = all
    .filter(
      (t) =>
        `${t.receipt} ${state.participants.find((p) => p.id === t.participantId)?.name}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "all" ||
          (filter === "void" && !!t.voidReason) ||
          (filter === t.type && !t.voidReason)),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const current = Math.min(page, Math.max(Math.ceil(filtered.length / 8), 1));
  return (
    <>
      <PageHeading
        title="Iuran Tunai"
        description="Catat penerimaan, pengembalian, dan koreksi transaksi dengan tertib."
        action={
          <>
            <Button
              variant="outline"
              disabled={readOnly || period.status === "draft"}
              onClick={() => setEditor(makeCashEditor("refund"))}
            >
              <Undo2 size={16} /> Pengembalian
            </Button>
            <Button
              className="q-primary-button"
              disabled={readOnly || period.status === "draft"}
              onClick={() => setEditor(makeCashEditor("deposit"))}
            >
              <Plus size={17} /> Catat setoran
            </Button>
          </>
        }
      />
      <div className="qm-cash-summary qm-mobile-only">
        <span>Setoran bersih</span>
        <strong>{money(data.net)}</strong>
      </div>
      <div className="q-stat-grid">
        <Stat
          label="Total setoran valid"
          value={shortMoney(data.deposits)}
          detail="Penerimaan tunai pada periode ini"
          icon={<ArrowDownLeft size={19} />}
        />
        <Stat
          label="Total pengembalian"
          value={shortMoney(data.refunds)}
          detail="Uang tunai yang dikembalikan"
          icon={<Undo2 size={19} />}
        />
        <Stat
          label="Setoran bersih"
          value={shortMoney(data.net)}
          detail="Setoran dikurangi pengembalian"
          icon={<Wallet size={19} />}
          featured
        />
        <Stat
          label="Transaksi valid"
          value={data.entries.length}
          detail={`${all.filter((t) => t.voidReason).length} transaksi di-void`}
          icon={<ReceiptText size={19} />}
        />
      </div>
      <Notice>
        <strong>Hanya pencatatan tunai.</strong> Pastikan uang telah diterima
        sebelum menyimpan setoran. Transaksi yang salah dikoreksi melalui void
        dengan alasan.
      </Notice>
      <Panel
        title="Riwayat transaksi"
        action={
          <Button
            variant="outline"
            onClick={() =>
              exportCsv(`iuran-${periodId}.csv`, [
                ...(preview
                  ? [["DATA CONTOH", "Bukan catatan transaksi nyata"]]
                  : []),
                [
                  "Kuitansi",
                  "Peserta",
                  "Tanggal",
                  "Jenis",
                  "Nominal",
                  "Petugas",
                  "Alasan void",
                ],
                ...all.map((t) => [
                  t.receipt,
                  state.participants.find((p) => p.id === t.participantId)
                    ?.name ?? "",
                  t.date,
                  t.type,
                  t.amount,
                  t.officer,
                  t.voidReason,
                ]),
              ])
            }
          >
            <Download size={15} /> Ekspor CSV
          </Button>
        }
      >
        <div className="q-table-toolbar">
          <div className="q-tabs">
            {[
              { id: "all", label: "Semua transaksi" },
              { id: "deposit", label: "Setoran" },
              { id: "refund", label: "Pengembalian" },
              { id: "void", label: "Void" },
            ].map((item) => (
              <button
                key={item.id}
                className={filter === item.id ? "is-active" : ""}
                onClick={() => {
                  setFilter(item.id);
                  setPage(1);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Cari peserta atau nomor kuitansi…"
          />
        </div>
        {mobile && (
          <div className="qm-cash-list qm-mobile-only">
            {filtered
              .slice((current - 1) * 8, current * 8)
              .map((t, index, entries) => (
                <div key={t.id}>
                  {(index === 0 || entries[index - 1].date !== t.date) && (
                    <p className="qm-date-heading">{dateLabel(t.date)}</p>
                  )}
                  <Link
                    href={`${base}/iuran/${t.id}`}
                    className={`qm-transaction-row ${t.voidReason ? "is-void" : ""}`}
                    aria-label={`Lihat transaksi ${t.receipt}`}
                  >
                    <span
                      className={`qm-action-icon ${t.type === "refund" ? "is-refund" : ""}`}
                    >
                      {t.type === "deposit" ? (
                        <ArrowDownLeft size={20} />
                      ) : (
                        <Undo2 size={20} />
                      )}
                    </span>
                    <span className="qm-row-copy">
                      <strong>
                        {
                          state.participants.find(
                            (p) => p.id === t.participantId,
                          )?.name
                        }
                      </strong>
                      <small>
                        {t.type === "deposit" ? "Setoran" : "Pengembalian"}
                        {t.time ? ` · ${t.time} WIB` : ""}
                      </small>
                      <small>{t.receipt}</small>
                    </span>
                    <span className="qm-row-amount">
                      <strong>
                        {t.type === "deposit" ? "+" : "−"}
                        {money(t.amount)}
                      </strong>
                      <small>
                        {t.voidReason ? <Badge>Void</Badge> : "Tunai"}
                      </small>
                    </span>
                  </Link>
                </div>
              ))}
          </div>
        )}
        {!mobile && (
          <div className="q-table-scroll">
            <table className="q-table">
              <thead>
                <tr>
                  <th>Transaksi</th>
                  <th>Peserta</th>
                  <th>Tanggal</th>
                  <th>Jenis</th>
                  <th>Nominal</th>
                  <th>Petugas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.slice((current - 1) * 8, current * 8).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.receipt}</strong>
                      <small>Tunai</small>
                    </td>
                    <td>
                      {
                        state.participants.find((p) => p.id === t.participantId)
                          ?.name
                      }
                    </td>
                    <td>{dateLabel(t.date, true)}</td>
                    <td>
                      <Badge>
                        {t.voidReason
                          ? "Void"
                          : t.type === "deposit"
                            ? "Setoran"
                            : "Pengembalian"}
                      </Badge>
                    </td>
                    <td
                      className={`q-money ${t.voidReason ? "q-void-amount" : ""}`}
                    >
                      {money(t.amount)}
                    </td>
                    <td>{t.officer}</td>
                    <td>
                      <Link
                        href={`${base}/iuran/${t.id}`}
                        aria-label={`Kuitansi ${t.receipt}`}
                        className="q-row-arrow"
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!filtered.length && (
          <EmptyState
            title="Belum ada transaksi yang sesuai"
            description="Ubah filter atau catat penerimaan uang tunai pertama."
          />
        )}
        <div className="q-pagination">
          <span>
            {filtered.length} transaksi · Halaman {current}
          </span>
          <div>
            <Button
              variant="outline"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              disabled={current * 8 >= filtered.length}
              onClick={() => setPage(current + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </Panel>
      <Editor config={editor} onClose={closeEditor} />
    </>
  );
}
