"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Download,
  ArrowUpRight,
  Users,
  UserCheck,
  Clock3,
  ArrowLeft,
  Pencil,
  UserRoundPlus,
  Ban,
  Phone,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQurban, useViewState } from "./demo-provider";
import {
  Badge,
  Editor,
  EmptyState,
  PageHeading,
  Panel,
  SearchBox,
  Stat,
  Progress,
  type EditorConfig,
} from "./ui";
import {
  balanceOf,
  dateLabel,
  exportCsv,
  initials,
  money,
  targetOf,
  totals,
  type Participant,
} from "@/lib/qurban-demo";
import { RegistrationFlow } from "./registration-flow";
import { MobileActions, MobileFilters } from "./mobile-controls";
import { useMobile } from "@/hooks/use-mobile";

export function ParticipantsView({ id }: { id?: string }) {
  const { state, setState, periodId, base, audit, preview, mutate } =
    useQurban();
  const params = useSearchParams();
  const [search, setSearch] = useViewState("peserta", "search", "");
  const [filter, setFilter] = useViewState(
    "peserta",
    "filter",
    "Semua peserta",
    params.get("filter") === "menunggu" ? "Belum berkelompok" : undefined,
  );
  const [page, setPage] = useViewState("peserta", "page", 1);
  const [created, setCreated] = useState<string | null>(null);
  const mobile = useMobile();
  const [payment, setPayment] = useViewState("peserta", "payment", "all");
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const period = state.periods.find((p) => p.id === periodId)!;
  const readOnly = ["completed", "archived"].includes(period.status);
  const data = totals(state, periodId);
  function addParticipant() {
    if (period.status !== "open") {
      toast.error("Pendaftaran hanya tersedia pada periode yang dibuka.");
      return;
    }
    const previous = preview
      ? state.participants.filter(
          (p, i, all) =>
            !all.some(
              (other) => other.name === p.name && other.periodId === periodId,
            ) && all.findIndex((other) => other.name === p.name) === i,
        )
      : (state.directory ?? []).filter(
          (p) =>
            !state.participants.some(
              (r) => r.participantId === p.id && r.periodId === periodId,
            ),
        );
    setEditor({
      title: "Tambah peserta",
      participantChoice: true,
      description:
        "Simpan identitas peserta terlebih dahulu. Pemilihan anggota dilakukan setelahnya di halaman Kelompok Sapi.",
      fields: [
        ...(previous.length
          ? [
              {
                name: "existing",
                label: "Gunakan data peserta lama",
                required: false,
                options: [
                  { value: "", label: "Buat data jamaah baru" },
                  ...previous.map((p) => ({
                    value: p.id,
                    label: `${p.name} - ${p.phone}`,
                  })),
                ],
                help: "Pilih jamaah yang pernah terdaftar agar identitasnya tidak perlu diisi ulang.",
              },
            ]
          : []),
        { name: "name", label: "Nama lengkap", hideWhen: "existing" },
        {
          name: "phone",
          label: "Nomor WhatsApp",
          type: "tel",
          hideWhen: "existing",
          help: "Format internasional, misalnya 628123456789.",
        },
        {
          name: "address",
          label: "Alamat",
          required: false,
          hideWhen: "existing",
        },
        {
          name: "registered",
          label: "Tanggal pendaftaran",
          type: "date",
          value: preview
            ? "2026-10-25"
            : new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Jakarta",
              }).format(new Date()),
        },
        { name: "notes", label: "Catatan", type: "textarea", required: false },
      ],
      submit: "Daftarkan peserta",
      save: (v) => {
        if (!preview)
          return mutate(
            "participant.create",
            { ...v, group: "" },
            undefined,
            periodId,
            (result) => setCreated(result.id ?? null),
          );
        if (v.registered < period.start || v.registered > period.end)
          return "Tanggal pendaftaran berada di luar rentang periode.";
        const old = state.participants.find((p) => p.id === v.existing);
        const name = (old?.name ?? v.name).trim();
        const phone = (old?.phone ?? v.phone).replace(/[\s+()-]/g, "");
        if (name.length < 2)
          return "Isi nama lengkap minimal dua karakter atau pilih data peserta lama.";
        if (!/^62\d{8,13}$/.test(phone))
          return "Nomor WhatsApp harus diawali 62 dan memiliki 10-15 digit.";
        if (
          state.participants.some(
            (p) =>
              p.periodId === periodId &&
              p.name.toLocaleLowerCase() === name.toLocaleLowerCase() &&
              p.phone === phone,
          )
        )
          return "Nama dan kontak tersebut sudah terdaftar pada periode ini. Periksa data peserta yang ada.";
        const item: Participant = {
          id: crypto.randomUUID(),
          number: `Q${String(period.year).slice(-2)}-${String(state.participants.filter((p) => p.periodId === periodId).length + 1).padStart(3, "0")}`,
          name,
          phone,
          address: old?.address ?? v.address,
          periodId,
          groupId: "",
          active: true,
          notes: v.notes,
        };
        setState((s) => ({ ...s, participants: [...s.participants, item] }));
        setCreated(item.id);
        audit("Peserta didaftarkan", `${name} · ${item.number}`, "Peserta");
        toast.success("Peserta ditambahkan ke data pratinjau.");
      },
    });
  }
  function editParticipant(p: Participant) {
    setEditor({
      title: "Ubah data peserta",
      description: `Data jamaah ${p.number}. Riwayat transaksi tetap tersimpan.`,
      fields: [
        { name: "name", label: "Nama lengkap", value: p.name },
        { name: "phone", label: "Nomor WhatsApp", value: p.phone, type: "tel" },
        { name: "address", label: "Alamat", value: p.address, required: false },
        {
          name: "notes",
          label: "Catatan",
          value: p.notes,
          type: "textarea",
          required: false,
        },
      ],
      save: (v) => {
        if (!preview) return mutate("participant.update", v, p.id);
        if (
          v.name.trim().length < 2 ||
          !/^62\d{8,13}$/.test(v.phone.replace(/[\s+()-]/g, ""))
        )
          return "Periksa nama dan nomor WhatsApp (format 62).";
        setState((s) => ({
          ...s,
          participants: s.participants.map((item) =>
            item.id === p.id
              ? {
                  ...item,
                  name: v.name.trim(),
                  phone: v.phone.replace(/[\s+()-]/g, ""),
                  address: v.address,
                  notes: v.notes,
                }
              : item,
          ),
        }));
        audit("Data peserta diperbarui", p.name, "Peserta");
        toast.success("Data peserta diperbarui dalam pratinjau.");
      },
    });
  }
  function cancel(p: Participant) {
    if (balanceOf(p.id, state.transactions) !== 0) {
      toast.error(
        "Kembalikan seluruh setoran bersih sebelum membatalkan peserta.",
      );
      return;
    }
    if (state.groups.find((g) => g.id === p.groupId)?.locked) {
      toast.error("Buka kembali kelompok sebelum membatalkan anggota.");
      return;
    }
    setEditor({
      title: "Batalkan kepesertaan",
      description:
        "Data dan riwayat peserta tetap disimpan. Slot akan tersedia untuk peserta lain.",
      fields: [
        { name: "reason", label: "Alasan pembatalan", type: "textarea" },
      ],
      submit: "Batalkan kepesertaan",
      save: (v) => {
        if (!preview) return mutate("participant.cancel", v, p.id);
        if (v.reason.trim().length < 5)
          return "Tulis alasan minimal lima karakter.";
        setState((s) => ({
          ...s,
          participants: s.participants.map((item) =>
            item.id === p.id
              ? {
                  ...item,
                  active: false,
                  notes: `${item.notes}\nPembatalan: ${v.reason}`,
                }
              : item,
          ),
        }));
        audit("Kepesertaan dibatalkan", `${p.name} · ${v.reason}`, "Peserta");
        toast.success("Kepesertaan dibatalkan dalam pratinjau.");
      },
    });
  }
  function reactivate(p: Participant) {
    if (period.status !== "open") {
      toast.error("Buka pendaftaran periode terlebih dahulu.");
      return;
    }
    setEditor({
      title: "Aktifkan kembali kepesertaan",
      description:
        "Gunakan nomor peserta dan riwayat yang sama. Peserta masuk daftar tunggu sebelum ditempatkan kembali.",
      fields: [
        {
          name: "reason",
          label: "Alasan pengaktifan kembali",
          type: "textarea",
        },
      ],
      submit: "Aktifkan kembali",
      save: (v) => {
        if (!preview) return mutate("participant.reactivate", v, p.id);
        if (v.reason.trim().length < 5) return "Alasan minimal lima karakter.";
        setState((s) => ({
          ...s,
          participants: s.participants.map((item) =>
            item.id === p.id
              ? {
                  ...item,
                  active: true,
                  groupId: "",
                  notes: `${item.notes}\nDiaktifkan kembali: ${v.reason}`,
                }
              : item,
          ),
        }));
        audit(
          "Kepesertaan diaktifkan kembali",
          `${p.name} · ${v.reason}`,
          "Peserta",
        );
        toast.success("Kepesertaan diaktifkan kembali dalam daftar tunggu.");
      },
    });
  }
  function download() {
    exportCsv(`peserta-${periodId}.csv`, [
      ...(preview ? [["DATA CONTOH", "Bukan catatan peserta nyata"]] : []),
      [
        "Nomor",
        "Nama",
        "WhatsApp",
        "Alamat",
        "Kelompok",
        "Status kepesertaan",
        "Catatan",
      ],
      ...state.participants
        .filter((p) => p.periodId === periodId)
        .map((p) => [
          p.number,
          p.name,
          p.phone,
          p.address,
          state.groups.find((g) => g.id === p.groupId)?.name ??
            "Belum berkelompok",
          p.active ? "Aktif" : "Dibatalkan",
          p.notes,
        ]),
    ]);
  }
  const person = id
    ? state.participants.find((p) => p.id === id && p.periodId === periodId)
    : undefined;
  if (id && !person)
    return (
      <>
        <PageHeading
          title="Peserta tidak ditemukan"
          description="Pilih periode yang sesuai atau kembali ke daftar peserta."
        />
        <Button asChild variant="outline">
          <Link href={`${base}/peserta`}>
            <ArrowLeft size={16} /> Kembali ke peserta
          </Link>
        </Button>
      </>
    );
  if (person) {
    const group = state.groups.find((g) => g.id === person.groupId);
    return (
      <>
        <Link className="q-back" href={`${base}/peserta`}>
          <ArrowLeft size={15} /> Semua peserta
        </Link>
        <PageHeading
          title={person.name}
          description={`${person.number} \u00b7 ${period.name}`}
          action={
            !readOnly && (
              <Button variant="outline" onClick={() => editParticipant(person)}>
                <Pencil size={15} /> Ubah data
              </Button>
            )
          }
        />
        <div className="qm-mobile-only">
          <div className="qm-person-balance">
            {person.active && group ? (
              <>
                <dl>
                  <div>
                    <dt>Target {group.locked ? "final" : "estimasi"}</dt>
                    <dd>{money(targetOf(group))}</dd>
                  </div>
                  <div>
                    <dt>Setoran bersih</dt>
                    <dd>{money(balanceOf(person.id, state.transactions))}</dd>
                  </div>
                  <div>
                    <dt>Sisa kewajiban</dt>
                    <dd>
                      {money(
                        Math.max(
                          targetOf(group) -
                            balanceOf(person.id, state.transactions),
                          0,
                        ),
                      )}
                    </dd>
                  </div>
                  {balanceOf(person.id, state.transactions) >
                    targetOf(group) && (
                    <div>
                      <dt>Kelebihan setoran</dt>
                      <dd>
                        {money(
                          balanceOf(person.id, state.transactions) -
                            targetOf(group),
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
                <Progress
                  value={
                    targetOf(group)
                      ? (balanceOf(person.id, state.transactions) /
                          targetOf(group)) *
                        100
                      : 0
                  }
                  label="Progres iuran peserta"
                />
                {!readOnly &&
                  balanceOf(person.id, state.transactions) <
                    targetOf(group) && (
                    <Button asChild>
                      <Link
                        href={`${base}/iuran?baru=1&peserta=${person.id}&kembali=${encodeURIComponent(`/peserta/${person.id}`)}`}
                      >
                        Catat setoran
                      </Link>
                    </Button>
                  )}
                {balanceOf(person.id, state.transactions) ===
                  targetOf(group) && (
                  <p style={{ marginTop: 12 }}>
                    <Badge>Lunas</Badge>
                  </p>
                )}
                {!readOnly && balanceOf(person.id, state.transactions) > 0 && (
                  <Link
                    className="qm-refund-link"
                    href={`${base}/iuran?baru=1&jenis=refund&peserta=${person.id}&kembali=${encodeURIComponent(`/peserta/${person.id}`)}`}
                  >
                    Catat pengembalian
                  </Link>
                )}
              </>
            ) : (
              <p>
                {person.active
                  ? "Peserta belum berkelompok. Tempatkan ke kelompok sebelum menerima setoran."
                  : "Kepesertaan dibatalkan. Riwayat tetap tersimpan."}
              </p>
            )}
          </div>
        </div>
        <div className="q-detail-grid">
          <Panel>
            <div className="q-person-profile">
              <span className="q-avatar q-avatar-large">
                {initials(person.name)}
              </span>
              <h2>{person.name}</h2>
              <p>{person.number}</p>
              <Badge>{person.active ? "Aktif" : "Dibatalkan"}</Badge>
            </div>
            <dl className="q-definition">
              <div>
                <dt>
                  <Phone size={14} /> WhatsApp
                </dt>
                <dd>+{person.phone}</dd>
              </div>
              <div>
                <dt>
                  <MapPin size={14} /> Alamat
                </dt>
                <dd>{person.address || "Belum diisi"}</dd>
              </div>
              <div>
                <dt>Catatan</dt>
                <dd>{person.notes || "Tidak ada catatan"}</dd>
              </div>
            </dl>
            {!readOnly && (
              <div className="q-profile-actions">
                {person.active ? (
                  <Button variant="destructive" onClick={() => cancel(person)}>
                    <Ban size={15} /> Batalkan kepesertaan
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => reactivate(person)}>
                    <UserRoundPlus size={15} /> Aktifkan kembali
                  </Button>
                )}
              </div>
            )}
          </Panel>
          <div>
            <RegistrationFlow current="participants" base={base} />
            <Panel
              title="Penempatan kelompok"
              description="Anggota dipilih dari data peserta di halaman Kelompok Sapi."
            >
              <div className="q-participant-placement">
                <span className="q-placement-icon">
                  <UserCheck size={25} />
                </span>
                <h3>
                  {!person.active
                    ? "Kepesertaan dibatalkan"
                    : group
                      ? group.name
                      : "Belum berkelompok"}
                </h3>
                <p>
                  {!person.active
                    ? "Aktifkan kembali kepesertaan sebelum memasukkan peserta ke kelompok."
                    : group
                      ? `Peserta telah menjadi anggota ${group.name}. Lihat dan kelola anggota di rincian kelompok.`
                      : "Data peserta sudah tersimpan. Pilih kelompok sapi, lalu tambahkan peserta ini sebagai anggota."}
                </p>
                {person.active && (
                  <Button asChild>
                    <Link
                      href={
                        group
                          ? `${base}/kelompok/${group.id}`
                          : {
                              pathname: `${base}/kelompok`,
                              query: { peserta: person.id },
                            }
                      }
                    >
                      {group ? "Lihat kelompok" : "Pilih kelompok sapi"}
                      <ArrowUpRight size={15} />
                    </Link>
                  </Button>
                )}
              </div>
            </Panel>
          </div>
        </div>
        <div className="qm-mobile-only">
          <Panel title="Riwayat iuran peserta">
            <TransactionRows
              entries={state.transactions
                .filter((t) => t.participantId === person.id)
                .sort((a, b) => b.date.localeCompare(a.date))}
              base={base}
            />
          </Panel>
        </div>
        <Editor config={editor} onClose={() => setEditor(null)} />
      </>
    );
  }
  const filtered = state.participants.filter(
    (p) =>
      p.periodId === periodId &&
      `${p.name} ${p.number} ${p.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "Semua peserta" ||
        (filter === "Belum berkelompok" && !p.groupId && p.active) ||
        (filter === "Sudah berkelompok" && !!p.groupId && p.active) ||
        (filter === "Dibatalkan" && !p.active)) &&
      (!mobile ||
        payment === "all" ||
        (p.active &&
          !!p.groupId &&
          (() => {
            const target = targetOf(
              state.groups.find((g) => g.id === p.groupId),
            );
            const net = balanceOf(p.id, state.transactions);
            return payment === "paid"
              ? net === target
              : payment === "unpaid"
                ? net === 0
                : payment === "excess"
                  ? net > target
                  : net > 0 && net < target;
          })())),
  );
  const current = Math.min(page, Math.max(Math.ceil(filtered.length / 8), 1));
  return (
    <>
      <PageHeading
        title="Peserta"
        description="Daftarkan dan perbarui identitas jamaah pada periode ini."
        action={
          <>
            <MobileActions
              compact
              title="Ekspor peserta"
              description={`${period.name} · Seluruh data peserta periode ini${preview ? " · Data contoh" : ""}.`}
              label="Ekspor"
            >
              <Button variant="outline" onClick={download}>
                <Download size={16} /> Ekspor data
              </Button>
            </MobileActions>
            <Button
              className="q-primary-button"
              onClick={addParticipant}
              disabled={readOnly || period.status !== "open"}
            >
              <Plus size={17} /> Tambah peserta
            </Button>
          </>
        }
      />
      <div className="qm-mobile-only">
        <div className="qm-list-summary">
          <span>{data.participants.length} peserta aktif</span>
          <span>{data.waiting} belum berkelompok</span>
        </div>
        {created && (
          <div className="q-notice">
            <div>
              <strong>Peserta berhasil didaftarkan.</strong>
              <p>Selanjutnya, tempatkan peserta ke kelompok sapi.</p>
              <Link
                className="q-text-link"
                href={`${base}/kelompok?peserta=${created}`}
              >
                Tempatkan ke kelompok <ArrowUpRight size={15} />
              </Link>
            </div>
            <button
              onClick={() => setCreated(null)}
              aria-label="Tutup informasi pendaftaran"
            >
              ×
            </button>
          </div>
        )}
      </div>
      <RegistrationFlow current="participants" base={base} />
      <div className="q-stat-grid">
        <Stat
          label="Peserta aktif"
          value={data.participants.length}
          detail="Terdaftar pada periode ini"
          icon={<Users size={19} />}
        />
        <Stat
          label="Belum berkelompok"
          value={data.waiting}
          detail="Siap dipilih di Kelompok Sapi"
          icon={<Clock3 size={19} />}
        />
        <Stat
          label="Sudah berkelompok"
          value={data.participants.length - data.waiting}
          detail="Sudah ditempatkan sebagai anggota"
          icon={<UserCheck size={19} />}
        />
        <Stat
          label="Dibatalkan"
          value={
            state.participants.filter(
              (p) => p.periodId === periodId && !p.active,
            ).length
          }
          detail="Riwayat data tetap tersimpan"
          icon={<Ban size={19} />}
        />
      </div>
      <div className="q-flow-callout">
        <div>
          <strong>
            {data.waiting
              ? `${data.waiting} peserta belum berkelompok`
              : "Data peserta dan kelompok saling terhubung"}
          </strong>
          <p>
            Setelah data tersimpan, buka Kelompok Sapi untuk membuat kelompok
            dan memilih anggotanya.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`${base}/kelompok`}>
            Buka Kelompok Sapi
            <ArrowUpRight size={15} />
          </Link>
        </Button>
      </div>
      <Panel>
        <div className="q-table-toolbar">
          <div className="q-tabs" aria-label="Filter data peserta">
            {[
              "Semua peserta",
              "Belum berkelompok",
              "Sudah berkelompok",
              "Dibatalkan",
            ].map((item) => (
              <button
                key={item}
                aria-pressed={filter === item}
                className={filter === item ? "is-active" : ""}
                onClick={() => {
                  setFilter(item);
                  setPage(1);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          {mobile && (
            <MobileFilters
              count={payment === "all" ? 0 : 1}
              onReset={() => {
                setPayment("all");
                setPage(1);
              }}
            >
              <label className="q-field">
                <span>Status pembayaran</span>
                <select
                  className="q-select"
                  value={payment}
                  onChange={(e) => {
                    setPayment(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Semua pembayaran</option>
                  <option value="unpaid">Belum setor</option>
                  <option value="partial">Mencicil</option>
                  <option value="paid">Lunas</option>
                  <option value="excess">Kelebihan setoran</option>
                </select>
              </label>
            </MobileFilters>
          )}
        </div>
        <div className="q-table-scroll">
          <table className="q-table q-participant-table">
            <thead>
              <tr>
                <th>Nama peserta</th>
                <th>WhatsApp</th>
                <th>Alamat</th>
                <th>Kelompok</th>
                <th>Status kepesertaan</th>
                <th>
                  <span className="sr-only">Rincian peserta</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * 8, current * 8).map((p) => {
                const group = state.groups.find((g) => g.id === p.groupId);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`${base}/peserta/${p.id}`}
                        className="q-table-person"
                      >
                        <span className="q-avatar">{initials(p.name)}</span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.number}</small>
                          {mobile && (
                            <span className="qm-mobile-only qm-participant-money">
                              <span>
                                {group && p.active
                                  ? group.name
                                  : p.active
                                    ? "Belum berkelompok"
                                    : "Kepesertaan dibatalkan"}
                              </span>
                              {p.active && group ? (
                                <>
                                  <span>
                                    Terkumpul{" "}
                                    {money(balanceOf(p.id, state.transactions))}
                                  </span>
                                  <b>
                                    {balanceOf(p.id, state.transactions) >
                                    targetOf(group)
                                      ? `Kelebihan ${money(balanceOf(p.id, state.transactions) - targetOf(group))}`
                                      : balanceOf(p.id, state.transactions) ===
                                          targetOf(group)
                                        ? "Lunas"
                                        : `Sisa ${money(Math.max(targetOf(group) - balanceOf(p.id, state.transactions), 0))}`}
                                  </b>
                                </>
                              ) : (
                                p.active && (
                                  <span>Belum dapat menerima setoran</span>
                                )
                              )}
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td>+{p.phone}</td>
                    <td className="q-participant-address">
                      {p.address || (
                        <span className="q-muted">Belum diisi</span>
                      )}
                    </td>
                    <td>
                      {group && p.active ? (
                        <Link
                          className="q-text-link"
                          href={`${base}/kelompok/${group.id}`}
                        >
                          {group.name}
                          <ArrowUpRight size={13} />
                        </Link>
                      ) : (
                        <span className="q-muted">
                          {p.active ? "Belum berkelompok" : "-"}
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge>{p.active ? "Aktif" : "Dibatalkan"}</Badge>
                    </td>
                    <td>
                      <Link
                        href={`${base}/peserta/${p.id}`}
                        className="q-row-arrow"
                        aria-label={`Detail ${p.name}`}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <EmptyState
            title={
              search || filter !== "Semua peserta"
                ? "Peserta belum ditemukan"
                : "Mulai dengan data peserta pertama"
            }
            description={
              search || filter !== "Semua peserta"
                ? "Ubah pencarian atau filter untuk melihat data lainnya."
                : "Tambahkan nama dan kontak jamaah. Peserta dapat dipilih sebagai anggota setelah kelompok dibuat."
            }
            action={
              !search &&
              filter === "Semua peserta" && (
                <Button
                  onClick={addParticipant}
                  disabled={readOnly || period.status !== "open"}
                >
                  <Plus size={15} /> Daftarkan peserta pertama
                </Button>
              )
            }
          />
        )}
        <div className="q-pagination">
          <span>
            Menampilkan {filtered.length ? (current - 1) * 8 + 1 : 0}-
            {Math.min(current * 8, filtered.length)} dari {filtered.length}{" "}
            peserta
          </span>
          <div>
            <Button
              variant="outline"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Sebelumnya
            </Button>
            <span>{current}</span>
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
      <Editor config={editor} onClose={() => setEditor(null)} />
    </>
  );
}

export function TransactionRows({
  entries,
  base,
}: {
  entries: ReturnType<typeof useQurban>["state"]["transactions"];
  base: string;
}) {
  return (
    <>
      <div className="q-table-scroll">
        <table className="q-table">
          <thead>
            <tr>
              <th>Kuitansi</th>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th>Nominal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <strong>{entry.receipt}</strong>
                  <small>{entry.officer}</small>
                </td>
                <td>{dateLabel(entry.date, true)}</td>
                <td>
                  <Badge>
                    {entry.voidReason
                      ? "Void"
                      : entry.type === "deposit"
                        ? "Setoran"
                        : "Pengembalian"}
                  </Badge>
                </td>
                <td className="q-money">{money(entry.amount)}</td>
                <td>
                  <Link
                    href={`${base}/iuran/${entry.id}`}
                    className="q-row-arrow"
                    aria-label={`Lihat ${entry.receipt}`}
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!entries.length && (
        <EmptyState
          title="Belum ada transaksi"
          description="Setoran dan pengembalian peserta akan tampil di sini."
        />
      )}
    </>
  );
}
