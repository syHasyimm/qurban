"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Info, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQurban } from "./demo-provider";
import type { EditorConfig } from "./ui";
import { balanceOf, dateLabel, money, targetOf } from "@/lib/qurban-demo";

export function CashFlow({
  config,
  onClose,
}: {
  config: EditorConfig;
  onClose: () => void;
}) {
  const { state, periodId, base, preview } = useQurban();
  const initial = Object.fromEntries(
    config.fields.map((f) => [f.name, String(f.value ?? "")]),
  );
  const [values, setValues] = useState(initial);
  const [step, setStep] = useState<
    "participant" | "form" | "review" | "success"
  >(initial.participant ? "form" : "participant");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const type = config.cash!.type;
  const refund = type === "refund";
  const period = state.periods.find((p) => p.id === periodId)!;
  const person = state.participants.find((p) => p.id === values.participant);
  const group = state.groups.find((g) => g.id === person?.groupId);
  const net = person ? balanceOf(person.id, state.transactions) : 0;
  const target = targetOf(group);
  const limit = refund ? net : Math.max(target - net, 0);
  const amount = Number(values.amount ?? 0);
  const nextNet = net + (refund ? -amount : amount);
  const resultId = config.cash!.receiptId();
  const receipt = state.transactions.find((t) => t.id === resultId);
  const available =
    config.fields
      .find((f) => f.name === "participant")
      ?.options?.filter((p) => p.value) ?? [];
  const candidates = state.participants.filter(
    (p) =>
      available.some((o) => o.value === p.id) &&
      `${p.name} ${p.number}`
        .toLocaleLowerCase("id")
        .includes(query.toLocaleLowerCase("id")),
  );
  const update = (field: string, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setError("");
  };
  const close = () => {
    if (pending) return;
    if (step !== "success" && (values.amount || values.notes)) setDiscard(true);
    else onClose();
  };
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!person || !group) {
      setError("Pilih peserta aktif yang sudah mendapat kelompok.");
      return;
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Isi nominal rupiah utuh yang lebih besar dari nol.");
      return;
    }
    if (amount > limit) {
      setError(
        `${refund ? "Pengembalian melebihi setoran bersih" : "Setoran melebihi sisa kewajiban"} ${money(limit)}.`,
      );
      return;
    }
    if (values.date < period.start || (!refund && values.date > period.due)) {
      setError("Tanggal serah terima berada di luar jadwal penerimaan iuran.");
      return;
    }
    setError("");
    setStep("review");
  }
  async function save() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    const signature = JSON.stringify(values);
    if (attempt.current?.signature !== signature)
      attempt.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await config.save({
        ...values,
        _requestId: attempt.current.id,
      });
      if (result) {
        setError(result);
        setUncertain(/Koneksi terputus|belum terkonfirmasi/.test(result));
      } else setStep("success");
    } catch {
      setUncertain(true);
      setError(
        "Status pencatatan belum terkonfirmasi. Coba simpan kembali dengan permintaan yang sama atau periksa riwayat.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  const heading = discard
    ? "Tinggalkan pencatatan?"
    : step === "review"
      ? `Periksa ${refund ? "pengembalian" : "setoran"}`
      : step === "success"
        ? "Pencatatan selesai"
        : refund
          ? "Catat pengembalian"
          : "Catat setoran";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="qm-overlay qm-menu-screen qm-cash-screen"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <DialogHeader className="qm-overlay-heading">
          <div>
            <DialogTitle>{heading}</DialogTitle>
            <DialogDescription className="qm-cash-step">
              {period.name}
              {step === "form"
                ? " · Langkah 1 dari 2"
                : step === "review"
                  ? " · Langkah 2 dari 2"
                  : ""}
            </DialogDescription>
          </div>
          <button
            className="qm-icon-button"
            aria-label="Tutup pencatatan"
            disabled={pending}
            onClick={close}
          >
            <X size={21} />
          </button>
        </DialogHeader>
        {preview && (
          <p className="qm-example-label">
            Mode contoh · Tidak mencatat transaksi nyata
          </p>
        )}
        {discard ? (
          <div className="qm-discard">
            <p>
              Isian ini belum disimpan. Anda dapat melanjutkan atau membuang
              perubahan.
            </p>
            <Button onClick={() => setDiscard(false)}>Lanjut mengisi</Button>
            <Button variant="outline" onClick={onClose}>
              Buang perubahan
            </Button>
          </div>
        ) : (
          <>
            <div className="qm-cash-body">
              {step === "participant" && (
                <>
                  <label className="q-search">
                    <input
                      aria-label="Cari peserta transaksi"
                      placeholder="Cari nama atau nomor peserta…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  {candidates.map((p) => {
                    const g = state.groups.find((g) => g.id === p.groupId);
                    const paid = balanceOf(p.id, state.transactions);
                    return (
                      <button
                        className="qm-cash-person"
                        key={p.id}
                        onClick={() => {
                          update("participant", p.id);
                          setStep("form");
                        }}
                      >
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {p.number} · {g?.name}
                          </small>
                          <b>
                            {refund ? "Dapat dikembalikan" : "Sisa kewajiban"}{" "}
                            {money(
                              refund ? paid : Math.max(targetOf(g) - paid, 0),
                            )}
                          </b>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    );
                  })}
                  {!candidates.length && (
                    <div className="q-empty">
                      <h3>
                        {query
                          ? "Peserta tidak ditemukan"
                          : "Tidak ada peserta yang dapat dipilih"}
                      </h3>
                      <p>
                        {query
                          ? "Coba nama atau nomor peserta lain."
                          : "Peserta harus aktif, sudah berkelompok, dan memenuhi syarat transaksi pada periode ini."}
                      </p>
                      <Button asChild variant="outline">
                        <Link href={`${base}/peserta`}>Lihat peserta</Link>
                      </Button>
                    </div>
                  )}
                </>
              )}
              {step === "form" && (
                <form
                  id="mobile-cash-form"
                  onSubmit={review}
                  className="q-form"
                >
                  <div className="qm-cash-selected">
                    <div>
                      <strong>{person?.name}</strong>
                      <small>
                        {person?.number} · {group?.name}
                      </small>
                      <small>
                        {refund ? "Dapat dikembalikan" : "Sisa kewajiban"}{" "}
                        {money(limit)}
                      </small>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setStep("participant");
                      }}
                    >
                      Ubah
                    </button>
                  </div>
                  <div className="qm-money-input">
                    <label htmlFor="cash-amount">
                      {refund
                        ? "Nominal dikembalikan"
                        : "Nominal tunai diterima"}
                    </label>
                    <div>
                      <span>Rp</span>
                      <input
                        id="cash-amount"
                        name="amount"
                        aria-label="Nominal tunai (Rp)"
                        inputMode="numeric"
                        autoComplete="off"
                        value={
                          values.amount
                            ? Number(values.amount).toLocaleString("id-ID")
                            : ""
                        }
                        onChange={(e) =>
                          update("amount", e.target.value.replace(/\D/g, ""))
                        }
                        required
                        placeholder="0"
                      />
                    </div>
                    <div className="qm-amounts">
                      {[100000, 250000, 500000]
                        .filter((v) => v < limit)
                        .map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => update("amount", String(v))}
                          >
                            {v / 1000} rb
                          </button>
                        ))}
                      {limit > 0 && (
                        <button
                          type="button"
                          onClick={() => update("amount", String(limit))}
                        >
                          {refund ? "Seluruhnya" : "Lunas"}
                        </button>
                      )}
                    </div>
                  </div>
                  <fieldset className="q-form-fields">
                    {config.fields
                      .filter(
                        (f) => !["participant", "amount"].includes(f.name),
                      )
                      .map((field) => (
                        <label className="q-field" key={field.name}>
                          <span>
                            {field.label}
                            {field.required === false ? " · opsional" : " *"}
                          </span>
                          {field.type === "textarea" ? (
                            <textarea
                              name={field.name}
                              rows={3}
                              required={field.required !== false}
                              value={values[field.name] ?? ""}
                              onChange={(e) =>
                                update(field.name, e.target.value)
                              }
                            />
                          ) : (
                            <input
                              name={field.name}
                              type={field.type ?? "text"}
                              required={field.required !== false}
                              value={values[field.name] ?? ""}
                              onChange={(e) =>
                                update(field.name, e.target.value)
                              }
                            />
                          )}
                        </label>
                      ))}
                  </fieldset>
                  <p className="qm-finance-note">
                    <Info size={15} />
                    {config.description}
                  </p>
                </form>
              )}
              {step === "review" && (
                <>
                  <div className="qm-cash-amount">
                    <small>Nominal {refund ? "pengembalian" : "setoran"}</small>
                    <strong>{money(amount)}</strong>
                  </div>
                  <dl className="qm-cash-check">
                    {[
                      ["Peserta", person?.name],
                      ["Nomor", person?.number],
                      ["Kelompok", group?.name],
                      ["Metode", "Tunai"],
                      ["Tanggal", dateLabel(values.date)],
                      ["Waktu", `${values.time ?? "12:00"} WIB`],
                      ["Dicatat oleh", state.accounts[0].name],
                      ["Catatan", values.notes || "Tidak ada catatan"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="qm-cash-impact">
                    <div>
                      <span>Setoran bersih sebelumnya</span>
                      <strong>{money(net)}</strong>
                    </div>
                    <div>
                      <span>Sesudah pencatatan</span>
                      <strong>{money(nextNet)}</strong>
                    </div>
                    <div>
                      <span>Sisa kewajiban</span>
                      <strong>{money(Math.max(target - nextNet, 0))}</strong>
                    </div>
                    {nextNet > target && (
                      <div>
                        <span>Kelebihan</span>
                        <strong>{money(nextNet - target)}</strong>
                      </div>
                    )}
                  </div>
                  <p className="qm-finance-note" style={{ marginTop: 18 }}>
                    <Info size={15} />
                    Pastikan uang tunai{" "}
                    {refund
                      ? "sudah diserahkan kembali kepada peserta"
                      : "sudah diterima panitia"}
                    .
                  </p>
                </>
              )}
              {step === "success" && (
                <div className="qm-cash-success" role="status">
                  <span>
                    <Check size={34} />
                  </span>
                  <h3>
                    {refund ? "Pengembalian" : "Setoran"} berhasil dicatat
                  </h3>
                  <strong>{money(amount)}</strong>
                  <p>{person?.name}</p>
                  {receipt && (
                    <dl>
                      <dt>Nomor kuitansi</dt>
                      <dd>{receipt.receipt}</dd>
                      <dt>Sisa kewajiban sekarang</dt>
                      <dd>
                        {money(
                          Math.max(
                            target - balanceOf(person!.id, state.transactions),
                            0,
                          ),
                        )}
                      </dd>
                    </dl>
                  )}
                  {preview && (
                    <p className="qm-example-label">
                      Kuitansi contoh · Bukan bukti transaksi nyata
                    </p>
                  )}
                </div>
              )}
              {error && (
                <p className="q-form-error" role="alert" tabIndex={-1}>
                  {error}
                </p>
              )}
            </div>
            {step !== "participant" && (
              <div className="qm-cash-footer">
                {step === "form" && (
                  <Button type="submit" form="mobile-cash-form">
                    Periksa {refund ? "pengembalian" : "setoran"}
                  </Button>
                )}
                {step === "review" && (
                  <>
                    <Button disabled={pending} onClick={() => void save()}>
                      {pending
                        ? "Menyimpan…"
                        : refund
                          ? "Simpan pengembalian"
                          : "Simpan setoran"}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={pending || uncertain}
                      onClick={() => setStep("form")}
                    >
                      <ArrowLeft size={16} />
                      Perbaiki isian
                    </Button>
                    {uncertain && (
                      <Button asChild variant="outline">
                        <Link href={`${base}/iuran`}>
                          Periksa riwayat pencatatan
                        </Link>
                      </Button>
                    )}
                  </>
                )}
                {step === "success" && (
                  <>
                    {resultId && (
                      <Button asChild>
                        <Link href={`${base}/iuran/${resultId}`}>
                          Lihat kuitansi
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setValues({
                          ...initial,
                          participant: "",
                          amount: "",
                          notes: "",
                        });
                        attempt.current = null;
                        setStep("participant");
                      }}
                    >
                      Catat {refund ? "pengembalian" : "setoran"} lain
                    </Button>
                    <Button variant="ghost" onClick={onClose}>
                      Kembali ke riwayat
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
