"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowUpRight,
  Globe,
  Eye,
  Save,
  Plus,
  ShieldCheck,
  Pencil,
  UserRoundX,
  UserRoundCheck,
  History,
  Wallet,
  Users,
  Beef,
  CalendarDays,
  KeyRound,
  X,
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
import { MobileFilters } from "./mobile-controls";
import { useQurban, useViewState } from "./demo-provider";
import {
  Badge,
  Editor,
  EmptyState,
  Notice,
  PageHeading,
  Panel,
  SearchBox,
  type EditorConfig,
} from "./ui";
import { PublicContent } from "./public-content";
import {
  initials,
  dateLabel,
  totals,
  type CommitteeAccount,
} from "@/lib/qurban-demo";

export function PublicSettingsView() {
  const mobile = useMobile();
  const { state, setState, audit, preview: demo, mutate, busy } = useQurban();
  const [tab, setTab] = useState("settings");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const featured = state.periods.find(
    (p) => p.featured && p.status !== "draft",
  );
  const data = featured ? totals(state, featured.id) : null;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    if (!demo) {
      const result = await mutate("settings.save", values);
      if (result) setError(result);
      else setSaved(true);
      return;
    }
    const whatsapp = values.whatsapp.replace(/[\s+()-]/g, "");
    if (whatsapp && !/^62\d{8,13}$/.test(whatsapp)) {
      setError("Nomor WhatsApp harus diawali 62 dan memiliki 10-15 digit.");
      return;
    }
    if (
      values.name.trim().length < 2 ||
      values.contact.trim().length < 2 ||
      values.description.trim().length < 15
    ) {
      setError(
        "Lengkapi nama panitia, narahubung, dan deskripsi minimal 15 karakter.",
      );
      return;
    }
    setState((s) => ({
      ...s,
      settings: {
        name: values.name.trim(),
        contact: values.contact.trim(),
        whatsapp,
        description: values.description.trim(),
        address: values.address.trim(),
      },
    }));
    audit("Informasi publik diperbarui", values.name, "Pengaturan");
    setSaved(true);
    toast.success(
      "Informasi tersimpan dalam pratinjau. Buka tab Pratinjau publik untuk melihat hasilnya.",
    );
  }
  return (
    <>
      <PageHeading
        title="Informasi Publik"
        description="Atur informasi program dan kontak yang dapat dilihat jamaah."
        action={
          <Button
            variant="outline"
            onClick={() => setTab(tab === "preview" ? "settings" : "preview")}
          >
            <Eye size={16} />{" "}
            {tab === "preview" ? "Kembali ke pengaturan" : "Lihat pratinjau"}
          </Button>
        }
      />
      <div className="q-tabs q-standalone-tabs">
        <button
          onClick={() => setTab("settings")}
          className={tab === "settings" ? "is-active" : ""}
        >
          <Globe size={15} /> Pengaturan informasi
        </button>
        <button
          onClick={() => setTab("preview")}
          className={tab === "preview" ? "is-active" : ""}
        >
          <Eye size={15} /> Pratinjau publik
        </button>
      </div>
      {tab === "settings" ? (
        <div className="q-settings-grid">
          <Panel
            title="Profil panitia"
            description="Gunakan informasi kontak yang memang diizinkan untuk dipublikasikan."
          >
            <form
              className="q-form q-settings-form"
              onSubmit={save}
              onChange={() => setSaved(false)}
            >
              <div className="q-form-fields">
                <label className="q-field q-field-wide">
                  <span>Nama panitia / program *</span>
                  <input
                    name="name"
                    defaultValue={state.settings.name}
                    required
                  />
                </label>
                <label className="q-field">
                  <span>Nama narahubung *</span>
                  <input
                    name="contact"
                    defaultValue={state.settings.contact}
                    required
                  />
                </label>
                <label className="q-field">
                  <span>Nomor WhatsApp</span>
                  <input
                    name="whatsapp"
                    type="tel"
                    defaultValue={state.settings.whatsapp}
                    placeholder="628123456789"
                  />
                  <small>
                    Format internasional tanpa tanda +. Kosongkan untuk
                    menonaktifkan kontak.
                  </small>
                </label>
                <label className="q-field q-field-wide">
                  <span>Deskripsi program *</span>
                  <textarea
                    name="description"
                    defaultValue={state.settings.description}
                    rows={4}
                    required
                  />
                </label>
                <label className="q-field q-field-wide">
                  <span>Alamat sekretariat</span>
                  <textarea
                    name="address"
                    defaultValue={state.settings.address}
                    rows={2}
                  />
                </label>
              </div>
              {error && (
                <p className="q-form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="q-form-actions">
                {saved && (
                  <span className="q-save-status" role="status">
                    {demo ? "Tersimpan di pratinjau" : "Tersimpan"}
                  </span>
                )}
                <Button
                  type="submit"
                  className="q-primary-button"
                  disabled={busy}
                >
                  <Save size={16} /> {busy ? "Menyimpan…" : "Simpan informasi"}
                </Button>
              </div>
            </form>
          </Panel>
          <div>
            <Panel title="Yang tampil di halaman publik">
              <div className="q-settings-info">
                <Globe size={27} />
                <h3>Informasi yang terbuka.</h3>
                <p>
                  Nama program, kontak panitia, jadwal, serta jumlah jamaah dan
                  perkembangan sapi pada periode sorotan.
                </p>
                <ul>
                  <li>Tanpa nama atau nomor jamaah</li>
                  <li>Tanpa rincian cicilan individual</li>
                  <li>Tanpa kuitansi dan data akun</li>
                </ul>
              </div>
            </Panel>
            <Notice>
              Tombol WhatsApp membuka percakapan dengan pesan awal. Percakapan
              tidak otomatis mendaftarkan peserta.
            </Notice>
            <Panel title="Periode sorotan">
              <div className="q-settings-featured">
                <CalendarDays size={22} />
                <div>
                  <strong>{featured?.name ?? "Belum ada sorotan"}</strong>
                  <p>Ubah melalui menu Periode.</p>
                </div>
                <Badge>{featured ? "Dipublikasikan" : "Belum diatur"}</Badge>
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <PublicPreview demo={demo} onClose={() => setTab("settings")}>
          <PublicContent
            settings={state.settings}
            period={featured ?? null}
            aggregate={
              data
                ? {
                    registered: data.participants.length,
                    grouped: data.participants.length - data.waiting,
                    planned: data.groups.length,
                    funded: data.groups.filter((g) =>
                      ["ready", "purchased", "slaughtered"].includes(g.status),
                    ).length,
                    purchased: data.groups.filter((g) =>
                      ["purchased", "slaughtered"].includes(g.status),
                    ).length,
                    slaughtered: data.groups.filter(
                      (g) => g.status === "slaughtered",
                    ).length,
                  }
                : null
            }
            compact={!mobile}
            demo={demo}
          />
        </PublicPreview>
      )}
    </>
  );
}

function PublicPreview({
  children,
  onClose,
  demo,
}: {
  children: ReactNode;
  onClose: () => void;
  demo: boolean;
}) {
  const mobile = useMobile();
  if (!mobile) return <div className="q-public-preview">{children}</div>;
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        className="qm-overlay qm-menu-screen"
        showCloseButton={false}
      >
        <DialogHeader className="qm-overlay-heading">
          <div>
            <DialogTitle>Pratinjau publik</DialogTitle>
            <DialogDescription>
              {demo
                ? "Mode contoh · Data tidak dipublikasikan"
                : "Informasi yang telah disimpan · Kembali untuk mengedit"}
            </DialogDescription>
          </div>
          <button
            className="qm-icon-button"
            aria-label="Kembali mengedit"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </DialogHeader>
        <div className="qm-preview-body">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function AccountsView() {
  const { state, setState, audit, preview: demo, mutate } = useQurban();
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  function edit(account?: CommitteeAccount) {
    setEditor({
      title: account
        ? "Ubah profil panitia"
        : demo
          ? "Tambah akun panitia contoh"
          : "Tambah akun panitia",
      description: demo
        ? "Pratinjau ini hanya mengubah daftar contoh. Belum ada akun login yang dibuat."
        : "Akun aktif mendapat kewenangan admin yang sama. Email yang diubah akan mengakhiri seluruh sesi akun tersebut.",
      fields: [
        { name: "name", label: "Nama lengkap", value: account?.name },
        {
          name: "email",
          label: "Alamat email",
          type: "email",
          value: account?.email,
        },
        ...(!demo && !account
          ? [
              {
                name: "password",
                label: "Password awal",
                type: "password",
                help: "Minimal 12 karakter. Sampaikan secara pribadi kepada panitia yang bersangkutan.",
              },
            ]
          : []),
      ],
      submit: demo
        ? account
          ? "Simpan profil contoh"
          : "Tambah ke daftar contoh"
        : account
          ? "Simpan profil"
          : "Buat akun panitia",
      save: (v) => {
        if (!demo) return mutate("admin.save", v, account?.id, "");
        if (v.name.trim().length < 2) return "Nama minimal dua karakter.";
        if (
          state.accounts.some(
            (a) =>
              a.email.toLowerCase() === v.email.toLowerCase() &&
              a.id !== account?.id,
          )
        )
          return "Email ini sudah digunakan oleh akun panitia lain.";
        if (account)
          setState((s) => ({
            ...s,
            accounts: s.accounts.map((a) =>
              a.id === account.id ? { ...a, name: v.name, email: v.email } : a,
            ),
          }));
        else
          setState((s) => ({
            ...s,
            accounts: [
              ...s.accounts,
              {
                id: crypto.randomUUID(),
                name: v.name,
                email: v.email,
                active: true,
                created: "2026-10-25",
              },
            ],
          }));
        audit(
          account
            ? "Profil panitia diperbarui"
            : "Akun panitia contoh ditambahkan",
          v.name,
          "Pengaturan",
        );
        toast.success(
          "Daftar panitia contoh diperbarui. Belum ada akun login yang dibuat.",
        );
      },
    });
  }
  function toggle(account: CommitteeAccount) {
    setEditor({
      title: account.active
        ? "Nonaktifkan akun panitia"
        : "Aktifkan akun panitia",
      description:
        "Seluruh panitia aktif memiliki kewenangan yang sama. Riwayat petugas tetap disimpan saat akun dinonaktifkan.",
      fields: [
        { name: "reason", label: "Alasan perubahan akses", type: "textarea" },
      ],
      submit: !demo
        ? account.active
          ? "Nonaktifkan akun"
          : "Aktifkan akun"
        : account.active
          ? "Nonaktifkan akun contoh"
          : "Aktifkan akun contoh",
      save: (v) => {
        if (!demo)
          return mutate(
            "admin.toggle",
            { ...v, active: !account.active },
            account.id,
            "",
          );
        if (v.reason.trim().length < 5) return "Alasan minimal lima karakter.";
        setState((s) => ({
          ...s,
          accounts: s.accounts.map((a) =>
            a.id === account.id ? { ...a, active: !a.active } : a,
          ),
        }));
        audit(
          account.active ? "Panitia dinonaktifkan" : "Panitia diaktifkan",
          `${account.name} · ${v.reason}`,
          "Pengaturan",
        );
        toast.success("Status akun contoh diperbarui.");
      },
    });
  }
  const filtered = state.accounts.filter(
    (a) =>
      `${a.name} ${a.email}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active" && a.active) ||
        (filter === "inactive" && !a.active)),
  );
  return (
    <>
      <PageHeading
        title="Akun Panitia"
        description="Kelola orang yang mendapat amanah untuk mengelola program qurban."
        action={
          <Button className="q-primary-button" onClick={() => edit()}>
            <Plus size={17} /> Tambah panitia
          </Button>
        }
      />
      <Notice>
        <ShieldCheck size={16} className="inline mr-1" />
        Hanya panitia yang memiliki akun login. Jamaah dicatat sebagai peserta
        dan tidak mempunyai akses dashboard.
      </Notice>
      <div className="q-account-overview">
        <Panel>
          <span className="q-avatar q-avatar-large">
            {initials(state.accounts[0].name)}
          </span>
          <div>
            <span className="q-muted">
              {demo ? "Profil saya · contoh" : "Profil saya"}
            </span>
            <h2>{state.accounts[0].name}</h2>
            <p>{state.accounts[0].email}</p>
            <Badge>Admin aktif</Badge>
          </div>
          <Button variant="outline" onClick={() => edit(state.accounts[0])}>
            <Pencil size={15} /> Ubah profil
          </Button>
        </Panel>
        <Panel>
          <ShieldCheck size={29} />
          <div>
            <h2>Akses yang setara</h2>
            <p>
              {state.accounts.filter((a) => a.active).length} panitia aktif.
              Setiap tindakan mencatat identitas petugas.
            </p>
            {demo ? (
              <span className="q-muted">
                <KeyRound size={13} className="inline mr-1" />
                Pengaturan password menyusul integrasi backend.
              </span>
            ) : (
              <Button
                variant="outline"
                onClick={() =>
                  setEditor({
                    title: "Ubah password",
                    description:
                      "Masukkan password saat ini. Seluruh sesi akun akan diakhiri setelah password berhasil diubah.",
                    fields: [
                      {
                        name: "current",
                        label: "Password saat ini",
                        type: "password",
                      },
                      {
                        name: "password",
                        label: "Password baru",
                        type: "password",
                        help: "Minimal 12 karakter.",
                      },
                      {
                        name: "confirm",
                        label: "Konfirmasi password baru",
                        type: "password",
                      },
                    ],
                    submit: "Simpan password",
                    save: (v) => mutate("account.password", v, undefined, ""),
                  })
                }
              >
                <KeyRound size={14} /> Ubah password
              </Button>
            )}
          </div>
        </Panel>
      </div>
      <Panel title="Daftar panitia">
        <div className="q-table-toolbar">
          <select
            className="q-select"
            aria-label="Filter status panitia"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Semua panitia</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Cari nama atau email panitia…"
          />
        </div>
        <div className="q-table-scroll">
          <table className="q-table">
            <thead>
              <tr>
                <th>Panitia</th>
                <th>Kewenangan</th>
                <th>Bergabung</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="q-table-person">
                      <span className="q-avatar">{initials(a.name)}</span>
                      <span>
                        <strong>
                          {a.name}
                          {a.id === state.accounts[0].id && " (Anda)"}
                        </strong>
                        <small>{a.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>Admin panitia</td>
                  <td>{dateLabel(a.created, true)}</td>
                  <td>
                    <Badge>{a.active ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td>
                    <div className="q-inline">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => edit(a)}
                        aria-label={`Ubah ${a.name}`}
                      >
                        <Pencil size={15} />
                      </Button>
                      {a.id !== state.accounts[0].id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggle(a)}
                          aria-label={`${a.active ? "Nonaktifkan" : "Aktifkan"} ${a.name}`}
                        >
                          {a.active ? (
                            <UserRoundX size={16} />
                          ) : (
                            <UserRoundCheck size={16} />
                          )}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <EmptyState description="Tidak ada akun panitia yang sesuai dengan pencarian." />
        )}
      </Panel>
      <Editor config={editor} onClose={() => setEditor(null)} />
    </>
  );
}

export function ActivityView() {
  const mobile = useMobile();
  const { state, periodId } = useQurban();
  const [search, setSearch] = useViewState("aktivitas", "search", "");
  const [category, setCategory] = useViewState("aktivitas", "category", "all");
  const [officer, setOfficer] = useViewState("aktivitas", "officer", "all");
  const [date, setDate] = useViewState("aktivitas", "date", "");
  const [expanded, setExpanded] = useState("");
  const icons: Record<string, typeof History> = {
    Keuangan: Wallet,
    Peserta: Users,
    Kelompok: Beef,
    Periode: CalendarDays,
    Pengaturan: ShieldCheck,
  };
  const filtered = state.activities.filter(
    (a) =>
      (a.periodId === periodId || a.category === "Pengaturan") &&
      `${a.action} ${a.detail}`.toLowerCase().includes(search.toLowerCase()) &&
      (category === "all" || a.category === category) &&
      (officer === "all" || a.actor === officer) &&
      (!date || a.date.slice(0, 10) === date),
  );
  return (
    <>
      <PageHeading
        title="Riwayat Aktivitas"
        description="Telusuri perubahan penting, petugas, dan alasan tindakan panitia."
      />
      <Notice>
        Riwayat aktivitas bersifat hanya baca. Pencatatan transaksi, koreksi,
        serta perubahan periode dan kelompok tetap dapat ditelusuri.
      </Notice>
      <Panel>
        <div className="q-activity-filters">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Cari aktivitas atau rincian…"
          />
          <MobileFilters
            count={
              Number(category !== "all") +
              Number(officer !== "all") +
              Number(!!date)
            }
            onReset={() => {
              setCategory("all");
              setOfficer("all");
              setDate("");
            }}
          >
            <select
              aria-label="Kategori aktivitas"
              className="q-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">Semua kategori</option>
              {Object.keys(icons).map((key) => (
                <option key={key}>{key}</option>
              ))}
            </select>
            <select
              aria-label="Petugas aktivitas"
              className="q-select"
              value={officer}
              onChange={(e) => setOfficer(e.target.value)}
            >
              <option value="all">Semua petugas</option>
              {[...new Set(state.activities.map((a) => a.actor))].map(
                (name) => (
                  <option key={name}>{name}</option>
                ),
              )}
            </select>
            <input
              className="q-select"
              aria-label="Tanggal aktivitas"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </MobileFilters>
          {(search || category !== "all" || officer !== "all" || date) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setCategory("all");
                setOfficer("all");
                setDate("");
              }}
            >
              Reset filter
            </Button>
          )}
        </div>
        <div className="q-activity-list">
          {filtered.map((a) => {
            const Icon = icons[a.category] ?? History;
            return (
              <div className="q-activity-item" key={a.id}>
                <span className="q-activity-icon">
                  <Icon size={19} />
                </span>
                <div>
                  <div className="q-inline">
                    <strong>{a.action}</strong>
                    <Badge tone="neutral">{a.category}</Badge>
                  </div>
                  <p>{a.detail}</p>
                  <small>
                    {a.actor} · {dateLabel(a.date, true)} ·{" "}
                    {new Intl.DateTimeFormat("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Jakarta",
                    }).format(new Date(a.date))}{" "}
                    WIB
                  </small>
                  {!mobile && expanded === a.id && (
                    <div className="q-activity-detail">
                      <span>ID aktivitas: {a.id}</span>
                      <span>Periode: {a.periodId}</span>
                      <span>Petugas: {a.actor}</span>
                      <span>Catatan: {a.detail}</span>
                      {a.changes?.map((change) => (
                        <span key={change}>{change}</span>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={expanded === a.id}
                  onClick={() => setExpanded(expanded === a.id ? "" : a.id)}
                >
                  {expanded === a.id ? "Tutup" : "Detail"}
                  <ArrowUpRight size={13} />
                </Button>
              </div>
            );
          })}
        </div>
        {!filtered.length && (
          <EmptyState
            title="Tidak ada aktivitas yang sesuai"
            description="Ubah kategori, petugas, tanggal, atau kata pencarian."
          />
        )}
        <div className="q-pagination">
          <span>{filtered.length} aktivitas ditemukan</span>
          <span>Riwayat tidak dapat diubah atau dihapus</span>
        </div>
      </Panel>
      {mobile && (
        <Dialog
          open={!!expanded}
          onOpenChange={(value) => {
            if (!value) setExpanded("");
          }}
        >
          <DialogContent
            className="qm-overlay qm-menu-screen"
            showCloseButton={false}
          >
            <DialogHeader className="qm-overlay-heading">
              <DialogTitle>Detail aktivitas</DialogTitle>
              <button
                className="qm-icon-button"
                aria-label="Tutup detail aktivitas"
                onClick={() => setExpanded("")}
              >
                <X size={21} />
              </button>
              <DialogDescription className="sr-only">
                Rincian perubahan dan identitas petugas, hanya baca.
              </DialogDescription>
            </DialogHeader>
            <div className="qm-activity-detail-body">
              {state.activities
                .filter((a) => a.id === expanded)
                .map((a) => (
                  <div key={a.id}>
                    <h3>{a.action}</h3>
                    <Badge tone="neutral">{a.category}</Badge>
                    <dl className="q-definition">
                      <div>
                        <dt>Petugas</dt>
                        <dd>{a.actor}</dd>
                      </div>
                      <div>
                        <dt>Waktu</dt>
                        <dd>
                          {dateLabel(a.date)} ·{" "}
                          {new Intl.DateTimeFormat("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Jakarta",
                          }).format(new Date(a.date))}{" "}
                          WIB
                        </dd>
                      </div>
                      <div>
                        <dt>Periode</dt>
                        <dd>
                          {state.periods.find((p) => p.id === a.periodId)
                            ?.name ?? "Pengaturan panitia"}
                        </dd>
                      </div>
                      <div>
                        <dt>Catatan</dt>
                        <dd>{a.detail}</dd>
                      </div>
                    </dl>
                    {a.changes?.map((change) => (
                      <p key={change}>{change}</p>
                    ))}
                    <small>ID aktivitas: {a.id}</small>
                  </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
