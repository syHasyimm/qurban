"use client";

import { useState } from "react";
import {
  Plus,
  CalendarDays,
  Star,
  Pencil,
  ArrowRight,
  Archive,
  LockKeyholeOpen,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMobile } from "@/hooks/use-mobile";
import { useQurban } from "./demo-provider";
import {
  Badge,
  Editor,
  Notice,
  PageHeading,
  Panel,
  EmptyState,
  type EditorConfig,
} from "./ui";
import {
  dateLabel,
  periodLabels,
  totals,
  balanceOf,
  type Period,
  type PeriodStatus,
} from "@/lib/qurban-demo";

export function PeriodsView() {
  const { state, setState, setPeriodId, periodId, audit, preview, mutate } =
    useQurban();
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<string | null>(null);
  const mobile = useMobile();
  function edit(period?: Period) {
    setEditor({
      title: period ? "Ubah periode" : "Buat periode qurban",
      description:
        "Tanggal pelaksanaan adalah rencana panitia dan dapat diperbarui sesuai keputusan yang digunakan.",
      fields: [
        {
          name: "name",
          label: "Nama periode",
          value: period?.name ?? (preview ? "Qurban 1450 H" : "Qurban 1448 H"),
        },
        {
          name: "year",
          label: "Tahun Hijriah",
          type: "number",
          min: 1,
          value: period?.year ?? (preview ? 1450 : 1448),
        },
        {
          name: "start",
          label: "Awal pendaftaran",
          type: "date",
          value: period?.start,
        },
        {
          name: "end",
          label: "Akhir pendaftaran",
          type: "date",
          value: period?.end,
        },
        {
          name: "due",
          label: "Batas pelunasan",
          type: "date",
          value: period?.due,
        },
        {
          name: "date",
          label: "Rencana pelaksanaan",
          type: "date",
          value: period?.date,
        },
        {
          name: "notes",
          label: "Catatan",
          type: "textarea",
          required: false,
          value: period?.notes,
        },
        ...(!preview && period
          ? [
              {
                name: "reason",
                label: "Alasan perubahan jadwal",
                type: "textarea",
                required: false,
                help: "Wajib jika jadwal pendaftaran, pelunasan, atau pelaksanaan berubah.",
              },
            ]
          : []),
      ],
      submit: period ? "Simpan perubahan" : "Buat periode draf",
      save: (v) => {
        if (!preview)
          return mutate("period.save", v, period?.id, period?.id ?? "");
        const year = Number(v.year);
        if (!Number.isInteger(year) || year < 1)
          return "Tahun Hijriah harus berupa bilangan bulat positif.";
        if (state.periods.some((p) => p.year === year && p.id !== period?.id))
          return "Tahun Hijriah tersebut sudah memiliki periode.";
        if (!(v.start <= v.end && v.end <= v.due && v.due <= v.date))
          return "Urutan tanggal: awal pendaftaran ≤ akhir pendaftaran ≤ pelunasan ≤ pelaksanaan.";
        const values = {
          name: v.name,
          year,
          start: v.start,
          end: v.end,
          due: v.due,
          date: v.date,
          notes: v.notes,
        };
        const savedId = period?.id ?? crypto.randomUUID();
        if (period)
          setState((s) => ({
            ...s,
            periods: s.periods.map((p) =>
              p.id === period.id ? { ...p, ...values } : p,
            ),
          }));
        else
          setState((s) => ({
            ...s,
            periods: [
              {
                ...values,
                id: savedId,
                status: "draft",
                featured: false,
              },
              ...s.periods,
            ],
          }));
        audit(
          period ? "Periode diperbarui" : "Periode dibuat",
          v.name,
          "Periode",
          savedId,
        );
        toast.success("Periode tersimpan dalam pratinjau.");
      },
    });
  }
  function transition(period: Period, status: PeriodStatus, reopen = false) {
    const data = totals(state, period.id);
    if (
      status === "completed" &&
      (data.remaining > 0 ||
        data.waiting > 0 ||
        data.groups.some((g) => g.status !== "slaughtered") ||
        data.participants.some((p) => {
          const group = state.groups.find((g) => g.id === p.groupId);
          return (
            group &&
            balanceOf(p.id, state.transactions) >
              Math.ceil(group.final / group.expected)
          );
        }))
    ) {
      toast.error(
        "Selesaikan seluruh kewajiban, pengembalian, daftar tunggu, dan pelaksanaan kelompok sebelum menutup periode.",
      );
      return;
    }
    setEditor({
      title: reopen
        ? "Buka kembali periode"
        : `Ubah status: ${periodLabels[status]}`,
      description: reopen
        ? "Pembukaan kembali harus memiliki alasan. Riwayat perubahan tetap tercatat."
        : "Status diubah secara eksplisit oleh panitia, bukan otomatis berdasarkan tanggal.",
      fields: [
        {
          name: "reason",
          label: "Alasan / catatan rekonsiliasi",
          type: "textarea",
        },
      ],
      submit: "Konfirmasi perubahan",
      save: (v) => {
        if (!preview)
          return mutate(
            "period.transition",
            { ...v, status },
            period.id,
            period.id,
          );
        if (v.reason.trim().length < 5)
          return "Isi alasan minimal lima karakter.";
        setState((s) => ({
          ...s,
          periods: s.periods.map((p) =>
            p.id === period.id
              ? { ...p, status, notes: `${p.notes}\n${v.reason}` }
              : p,
          ),
        }));
        audit(
          reopen ? "Periode dibuka kembali" : "Status periode diperbarui",
          `${period.name} · ${periodLabels[status]} · ${v.reason}`,
          "Periode",
          period.id,
        );
        toast.success("Status periode diperbarui dalam pratinjau.");
      },
    });
  }
  function feature(period: Period, remove = false) {
    if (mobile) {
      const previous = state.periods.find((p) => p.featured);
      setEditor({
        title: remove ? "Hentikan sorotan publik" : "Jadikan sorotan publik",
        description: remove
          ? `Halaman publik tidak akan menampilkan periode sorotan setelah ${period.name} dilepas.`
          : `${period.name} akan ditampilkan kepada publik${previous && previous.id !== period.id ? ` menggantikan ${previous.name}` : ""}. Periode pengelolaan Anda tetap sama.`,
        fields: [],
        submit: remove ? "Hentikan sorotan" : "Tampilkan periode",
        save: () => applyFeature(period, remove),
      });
    } else
      void applyFeature(period, remove).then((error) => {
        if (error) toast.error(error);
      });
  }
  async function applyFeature(period: Period, remove = false) {
    if (period.status === "draft") return;
    if (!preview) {
      return mutate("period.feature", { remove }, period.id, period.id);
    }
    setState((s) => ({
      ...s,
      periods: s.periods.map((p) => ({
        ...p,
        featured: !remove && p.id === period.id,
      })),
    }));
    audit(
      remove ? "Sorotan publik dinonaktifkan" : "Sorotan publik diperbarui",
      period.name,
      "Periode",
      period.id,
    );
    toast.success(
      "Sorotan publik contoh diperbarui. Lihat pratinjau di Informasi Publik.",
    );
  }
  const filtered = state.periods.filter(
    (p) =>
      filter === "all" ||
      (filter === "active" && ["draft", "open", "closed"].includes(p.status)) ||
      (filter === "history" && ["completed", "archived"].includes(p.status)),
  );
  return (
    <>
      <PageHeading
        title="Periode Qurban"
        description="Pisahkan peserta, kelompok, dan laporan untuk setiap tahun pelaksanaan."
        action={
          <Button className="q-primary-button" onClick={() => edit()}>
            <Plus size={17} /> Buat periode
          </Button>
        }
      />
      <div className="q-tabs q-standalone-tabs">
        {[
          { id: "all", label: "Semua periode" },
          { id: "active", label: "Periode berjalan & draf" },
          { id: "history", label: "Riwayat & arsip" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={filter === tab.id ? "is-active" : ""}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="q-period-list">
        {filtered.map((p) => {
          const data = totals(state, p.id);
          const readonly = ["completed", "archived"].includes(p.status);
          const card = (
            <Panel
              key={p.id}
              className={`q-period-card ${p.id === periodId ? "is-selected" : ""}`}
            >
              <div className="q-period-card-head">
                <span className="q-calendar-tile">
                  <CalendarDays size={24} />
                  <b>{p.year}</b>
                </span>
                <div>
                  <div className="q-inline">
                    <h2>{p.name}</h2>
                    {p.featured && (
                      <span className="q-featured-label">
                        <Star size={12} fill="currentColor" /> Sorotan publik
                      </span>
                    )}
                  </div>
                  <p>{dateLabel(p.date)} · Rencana pelaksanaan</p>
                </div>
                <Badge>{periodLabels[p.status]}</Badge>
              </div>
              <div className="q-period-dates">
                <div>
                  <span>Pendaftaran</span>
                  <strong>
                    {dateLabel(p.start, true)} - {dateLabel(p.end, true)}
                  </strong>
                </div>
                <div>
                  <span>Batas pelunasan</span>
                  <strong>{dateLabel(p.due, true)}</strong>
                </div>
                <div>
                  <span>Peserta & kelompok</span>
                  <strong>
                    {data.participants.length} jamaah · {data.groups.length}{" "}
                    sapi
                  </strong>
                </div>
              </div>
              <p className="q-period-notes">{p.notes}</p>
              <div
                className="q-period-card-actions"
                onClickCapture={() => {
                  if (mobile) setDetail(null);
                }}
              >
                <Button
                  variant={p.id === periodId ? "secondary" : "outline"}
                  onClick={() => {
                    setPeriodId(p.id);
                    toast.success(
                      `${p.name} dipilih sebagai periode pengelolaan.`,
                    );
                  }}
                >
                  {p.id === periodId ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <ArrowRight size={15} />
                  )}
                  {p.id === periodId ? "Sedang dikelola" : "Pilih periode"}
                </Button>
                {!readonly && (
                  <Button variant="ghost" onClick={() => edit(p)}>
                    <Pencil size={14} /> Ubah
                  </Button>
                )}
                {p.status !== "draft" && !p.featured && (
                  <Button variant="ghost" onClick={() => feature(p)}>
                    <Star size={14} /> Jadikan sorotan
                  </Button>
                )}
                {p.featured && (
                  <Button variant="ghost" onClick={() => feature(p, true)}>
                    <Star size={14} /> Hentikan sorotan
                  </Button>
                )}
                {p.status === "draft" && (
                  <Button onClick={() => transition(p, "open")}>
                    Buka pendaftaran
                  </Button>
                )}
                {p.status === "open" && (
                  <Button
                    variant="outline"
                    onClick={() => transition(p, "closed")}
                  >
                    Tutup pendaftaran
                  </Button>
                )}
                {p.status === "closed" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => transition(p, "open", true)}
                    >
                      Buka pendaftaran kembali
                    </Button>
                    <Button onClick={() => transition(p, "completed")}>
                      Selesaikan periode
                    </Button>
                  </>
                )}
                {p.status === "completed" && (
                  <Button
                    variant="outline"
                    onClick={() => transition(p, "archived")}
                  >
                    <Archive size={15} /> Arsipkan
                  </Button>
                )}
                {readonly && (
                  <Button
                    variant="outline"
                    onClick={() => transition(p, "closed", true)}
                  >
                    <LockKeyholeOpen size={15} /> Buka kembali
                  </Button>
                )}
              </div>
            </Panel>
          );
          return mobile ? (
            <div key={p.id}>
              <button
                className={`qm-period-card ${p.id === periodId ? "is-selected" : ""}`}
                onClick={() => setDetail(p.id)}
              >
                <span className="qm-action-icon">
                  <CalendarDays size={22} />
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{dateLabel(p.date)} · Pelaksanaan</small>
                  <Badge>{periodLabels[p.status]}</Badge>
                  {p.featured && <small>Sorotan publik</small>}
                  {p.id === periodId && <small>Sedang dikelola</small>}
                </span>
                <ArrowRight size={18} />
              </button>
              <Dialog
                open={detail === p.id}
                onOpenChange={(value) => {
                  if (!value) setDetail(null);
                }}
              >
                <DialogContent className="qm-overlay qm-menu-screen qm-period-detail">
                  <DialogHeader>
                    <DialogTitle className="sr-only">
                      Detail {p.name}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Jadwal, status, dan pengelolaan periode qurban.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="qm-period-detail-body">{card}</div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            card
          );
        })}
      </div>
      {!filtered.length && (
        <EmptyState description="Belum ada periode pada filter ini." />
      )}
      <Notice>
        Hanya satu periode menjadi sorotan publik. Saldo tidak berpindah
        antarperiode. Periode selesai dan arsip bersifat hanya baca.
      </Notice>
      <Editor config={editor} onClose={() => setEditor(null)} />
    </>
  );
}
