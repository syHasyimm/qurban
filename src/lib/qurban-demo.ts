// Frontend fixtures only. No data in this module comes from the database.
export type PeriodStatus =
  "draft" | "open" | "closed" | "completed" | "archived";
export type GroupStatus =
  | "forming"
  | "collecting"
  | "ready"
  | "purchased"
  | "slaughtered"
  | "cancelled";
export type Period = {
  id: string;
  name: string;
  year: number;
  start: string;
  end: string;
  due: string;
  date: string;
  status: PeriodStatus;
  featured: boolean;
  notes: string;
};
export type Participant = {
  participantId?: string;
  id: string;
  number: string;
  name: string;
  phone: string;
  address: string;
  periodId: string;
  groupId: string;
  active: boolean;
  notes: string;
};
export type Group = {
  id: string;
  periodId: string;
  name: string;
  breed: string;
  expected: number;
  estimate: number;
  final: number;
  locked: boolean;
  status: GroupStatus;
  purchaseCost: number;
  purchasedOn: string;
  slaughteredOn: string;
  notes: string;
};
export type CashEntry = {
  time?: string;
  id: string;
  receipt: string;
  participantId: string;
  type: "deposit" | "refund";
  amount: number;
  date: string;
  officer: string;
  notes: string;
  voidReason: string;
};
export type CommitteeAccount = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  created: string;
};
export type Activity = {
  changes?: string[];
  id: string;
  action: string;
  detail: string;
  actor: string;
  date: string;
  periodId: string;
  category: string;
};
export type SiteSettings = {
  name: string;
  contact: string;
  whatsapp: string;
  description: string;
  address: string;
};
export type DemoState = {
  directory?: { id: string; name: string; phone: string; address: string }[];
  periods: Period[];
  participants: Participant[];
  groups: Group[];
  transactions: CashEntry[];
  accounts: CommitteeAccount[];
  activities: Activity[];
  settings: SiteSettings;
};

export const periodLabels: Record<PeriodStatus, string> = {
  draft: "Draf",
  open: "Pendaftaran dibuka",
  closed: "Pendaftaran ditutup",
  completed: "Selesai",
  archived: "Diarsipkan",
};
export const groupLabels: Record<GroupStatus, string> = {
  forming: "Pembentukan",
  collecting: "Pengumpulan iuran",
  ready: "Siap dibeli",
  purchased: "Sudah dibeli",
  slaughtered: "Sudah dikurbankan",
  cancelled: "Dibatalkan",
};
export const menuItems = [
  { slug: "dashboard", label: "Dashboard" },
  { slug: "periode", label: "Periode" },
  { slug: "peserta", label: "Peserta" },
  { slug: "kelompok", label: "Kelompok Sapi" },
  { slug: "iuran", label: "Iuran Tunai" },
  { slug: "laporan", label: "Laporan" },
  { slug: "informasi-publik", label: "Informasi Publik" },
  { slug: "akun-panitia", label: "Akun Panitia" },
  { slug: "aktivitas", label: "Riwayat Aktivitas" },
] as const;
export type Section = (typeof menuItems)[number]["slug"];
export const money = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
export const shortMoney = (amount: number) =>
  amount >= 1_000_000
    ? `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(amount / 1_000_000)} jt`
    : money(amount);
export function dateLabel(value: string, short = false) {
  return value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: short ? "short" : "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(
        new Date(
          value.includes("T")
            ? /[Zz]$|[+-]\d{2}:\d{2}$/.test(value)
              ? value
              : `${value}+07:00`
            : `${value}T12:00:00+07:00`,
        ),
      )
    : "Belum ditentukan";
}
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
export function targetOf(group?: Group) {
  return group
    ? Math.ceil((group.locked ? group.final : group.estimate) / group.expected)
    : 0;
}
export function balanceOf(participantId: string, entries: CashEntry[]) {
  return entries
    .filter(
      (entry) => entry.participantId === participantId && !entry.voidReason,
    )
    .reduce(
      (sum, entry) =>
        sum + (entry.type === "deposit" ? entry.amount : -entry.amount),
      0,
    );
}
export function paymentStatus(
  participant: Participant,
  groups: Group[],
  entries: CashEntry[],
) {
  if (!participant.active) return "Dibatalkan";
  const group = groups.find((item) => item.id === participant.groupId);
  if (!group) return "Daftar tunggu";
  const balance = balanceOf(participant.id, entries);
  const target = targetOf(group);
  if (balance > target) return "Perlu pengembalian";
  if (balance === target) return group.locked ? "Lunas" : "Lunas estimasi";
  return balance === 0 ? "Belum bayar" : "Mencicil";
}
export function totals(state: DemoState, periodId: string) {
  const participants = state.participants.filter(
    (p) => p.periodId === periodId && p.active,
  );
  const groups = state.groups.filter(
    (g) =>
      g.periodId === periodId &&
      g.status !== "cancelled" &&
      participants.some((p) => p.groupId === g.id),
  );
  const entries = state.transactions.filter(
    (t) =>
      !t.voidReason &&
      state.participants.some(
        (p) => p.id === t.participantId && p.periodId === periodId,
      ),
  );
  const deposits = entries
    .filter((t) => t.type === "deposit")
    .reduce((n, t) => n + t.amount, 0);
  const refunds = entries
    .filter((t) => t.type === "refund")
    .reduce((n, t) => n + t.amount, 0);
  const obligation = participants.reduce(
    (n, p) => n + targetOf(groups.find((g) => g.id === p.groupId)),
    0,
  );
  const remaining = participants.reduce(
    (n, p) =>
      n +
      Math.max(
        targetOf(groups.find((g) => g.id === p.groupId)) -
          balanceOf(p.id, state.transactions),
        0,
      ),
    0,
  );
  return {
    participants,
    groups,
    entries,
    deposits,
    refunds,
    net: deposits - refunds,
    obligation,
    remaining,
    paid: participants.filter((p) =>
      ["Lunas", "Lunas estimasi"].includes(
        paymentStatus(p, groups, state.transactions),
      ),
    ).length,
    waiting: participants.filter((p) => !p.groupId).length,
  };
}

export function createDemoState(): DemoState {
  const names = [
    "Ahmad Fauzi",
    "Muhammad Ridwan",
    "Siti Aminah",
    "Abdul Rahman",
    "Nur Aisyah",
    "Hendra Saputra",
    "Dewi Lestari",
    "Budi Santoso",
    "Sri Wahyuni",
    "Agus Setiawan",
    "Fatimah Zahra",
    "Dedi Kurniawan",
    "Rina Marlina",
    "Yusuf Hidayat",
    "Hasan Basri",
    "Lina Herlina",
    "Umar Faruq",
    "M. Ilham Pratama",
  ];
  const participants: Participant[] = names.map((name, i) => ({
    id: `peserta-${i + 1}`,
    number: `Q48-${String(i + 1).padStart(3, "0")}`,
    name,
    phone: `628120000${String(i + 1).padStart(4, "0")}`,
    address: `Jl. Melati No. ${i + 1}, RT 03 / RW 02`,
    periodId: "1448",
    groupId: i < 7 ? "sapi-01" : i < 14 ? "sapi-02" : i < 17 ? "sapi-03" : "",
    active: true,
    notes: "Data contoh untuk pratinjau frontend.",
  }));
  const transactions: CashEntry[] = participants
    .filter((p) => p.groupId)
    .flatMap((p, i) => {
      const amount =
        i < 7
          ? 4_000_000
          : i < 14
            ? [
                2_000_000, 1_500_000, 3_000_000, 4_200_000, 1_000_000,
                2_500_000, 500_000,
              ][i - 7]
            : 500_000;
      return [
        {
          id: `trx-${i + 1}`,
          receipt: `KWT-1448-${String(i + 1).padStart(4, "0")}`,
          participantId: p.id,
          type: "deposit" as const,
          amount,
          date: `2026-10-${String(10 + (i % 15)).padStart(2, "0")}`,
          officer: i % 2 ? "Rizky Ramadhan" : "Ahmad Abdullah",
          notes: i < 7 ? "Pelunasan iuran qurban" : "Setoran iuran tunai",
          voidReason: "",
        },
      ];
    });
  return {
    periods: [
      {
        id: "1448",
        name: "Qurban 1448 H",
        year: 1448,
        start: "2026-09-01",
        end: "2027-04-30",
        due: "2027-05-10",
        date: "2027-05-17",
        status: "open",
        featured: true,
        notes:
          "Tanggal pelaksanaan mengikuti keputusan panitia dan dapat diperbarui.",
      },
      {
        id: "1449",
        name: "Qurban 1449 H",
        year: 1449,
        start: "2027-06-01",
        end: "2028-04-20",
        due: "2028-04-30",
        date: "2028-05-06",
        status: "draft",
        featured: false,
        notes: "Persiapan periode berikutnya.",
      },
      {
        id: "1447",
        name: "Qurban 1447 H",
        year: 1447,
        start: "2025-09-01",
        end: "2026-05-01",
        due: "2026-05-20",
        date: "2026-05-27",
        status: "archived",
        featured: false,
        notes:
          "Contoh periode arsip. Belum ada riwayat peserta dalam pratinjau ini.",
      },
    ],
    participants,
    transactions,
    groups: [
      {
        id: "sapi-01",
        periodId: "1448",
        name: "Sapi 01",
        breed: "Sapi limosin",
        expected: 7,
        estimate: 28_000_000,
        final: 28_000_000,
        locked: true,
        status: "ready",
        purchaseCost: 0,
        purchasedOn: "",
        slaughteredOn: "",
        notes:
          "Harga dan tujuh anggota telah disepakati. Tidak ada selisih pembulatan.",
      },
      {
        id: "sapi-02",
        periodId: "1448",
        name: "Sapi 02",
        breed: "Sapi simental",
        expected: 7,
        estimate: 29_400_000,
        final: 29_400_000,
        locked: true,
        status: "collecting",
        purchaseCost: 0,
        purchasedOn: "",
        slaughteredOn: "",
        notes: "Menunggu pelunasan seluruh anggota.",
      },
      {
        id: "sapi-03",
        periodId: "1448",
        name: "Sapi 03",
        breed: "Sapi peranakan ongole",
        expected: 7,
        estimate: 28_000_000,
        final: 0,
        locked: false,
        status: "forming",
        purchaseCost: 0,
        purchasedOn: "",
        slaughteredOn: "",
        notes: "Target sementara. Masih tersedia empat tempat.",
      },
    ],
    accounts: [
      {
        id: "admin-1",
        name: "Ahmad Abdullah",
        email: "ahmad@example.test",
        active: true,
        created: "2026-09-01",
      },
      {
        id: "admin-2",
        name: "Rizky Ramadhan",
        email: "rizky@example.test",
        active: true,
        created: "2026-09-02",
      },
      {
        id: "admin-3",
        name: "Fajar Maulana",
        email: "fajar@example.test",
        active: false,
        created: "2025-09-01",
      },
    ],
    activities: [
      {
        id: "log-1",
        action: "Setoran tunai dicatat",
        detail: "Hasan Basri · KWT-1448-0015 · Rp500.000",
        actor: "Ahmad Abdullah",
        date: "2026-10-24T09:30:00",
        periodId: "1448",
        category: "Keuangan",
      },
      {
        id: "log-2",
        action: "Peserta didaftarkan",
        detail: "M. Ilham Pratama masuk daftar tunggu",
        actor: "Rizky Ramadhan",
        date: "2026-10-23T14:15:00",
        periodId: "1448",
        category: "Peserta",
      },
      {
        id: "log-3",
        action: "Harga kelompok dikunci",
        detail: "Sapi 01 · 7 anggota · Rp28.000.000",
        actor: "Ahmad Abdullah",
        date: "2026-10-22T10:00:00",
        periodId: "1448",
        category: "Kelompok",
      },
      {
        id: "log-4",
        action: "Periode dibuka",
        detail: "Qurban 1448 H menjadi sorotan publik",
        actor: "Ahmad Abdullah",
        date: "2026-09-01T08:00:00",
        periodId: "1448",
        category: "Periode",
      },
    ],
    settings: {
      name: "Panitia Qurban Al-Ikhlas",
      contact: "Ahmad Abdullah",
      whatsapp: "",
      description:
        "Wujudkan niat berqurban bersama. Iuran yang ringan, pencatatan yang terbuka, dan kebersamaan yang membawa kebaikan.",
      address: "Sekretariat Masjid Al-Ikhlas",
    },
  };
}

export function exportCsv(filename: string, rows: (string | number)[][]) {
  const content =
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell);
            const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
            return `"${safe.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
