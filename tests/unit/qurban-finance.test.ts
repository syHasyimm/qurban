import { describe, expect, it } from "vitest";
import {
  balanceOf,
  createDemoState,
  paymentStatus,
  targetOf,
  totals,
  type CashEntry,
} from "@/lib/qurban-demo";

describe("perhitungan iuran frontend", () => {
  it("menghitung setoran bersih dari deposit dan refund valid, mengabaikan void", () => {
    const entries: CashEntry[] = [
      {
        id: "a",
        receipt: "a",
        participantId: "p",
        type: "deposit",
        amount: 1000000,
        date: "2026-10-25",
        officer: "Panitia",
        notes: "",
        voidReason: "",
      },
      {
        id: "b",
        receipt: "b",
        participantId: "p",
        type: "refund",
        amount: 250000,
        date: "2026-10-25",
        officer: "Panitia",
        notes: "",
        voidReason: "",
      },
      {
        id: "c",
        receipt: "c",
        participantId: "p",
        type: "deposit",
        amount: 500000,
        date: "2026-10-25",
        officer: "Panitia",
        notes: "",
        voidReason: "Salah input",
      },
    ];
    expect(balanceOf("p", entries)).toBe(750000);
  });
  it("membulatkan target per anggota ke atas dalam rupiah utuh", () => {
    const group = { ...createDemoState().groups[0], final: 28000001 };
    expect(targetOf(group)).toBe(4000001);
    expect(targetOf(group) * group.expected - group.final).toBe(6);
  });
  it("membedakan lunas final, lunas estimasi, kelebihan, dan daftar tunggu", () => {
    const state = createDemoState();
    const participant = state.participants[0];
    expect(paymentStatus(participant, state.groups, state.transactions)).toBe(
      "Lunas",
    );
    const estimates = state.groups.map((g) => ({ ...g, locked: false }));
    expect(paymentStatus(participant, estimates, state.transactions)).toBe(
      "Lunas estimasi",
    );
    const reduced = state.groups.map((g) => ({ ...g, final: 21000000 }));
    expect(paymentStatus(participant, reduced, state.transactions)).toBe(
      "Perlu pengembalian",
    );
    expect(
      paymentStatus(state.participants[17], state.groups, state.transactions),
    ).toBe("Daftar tunggu");
  });
  it("tidak mencampur peserta, kelompok, dan transaksi antarperiode", () => {
    const state = createDemoState();
    expect(totals(state, "1448").participants).toHaveLength(18);
    expect(totals(state, "1448").groups).toHaveLength(3);
    expect(totals(state, "1447").net).toBe(0);
    expect(totals(state, "1447").participants).toHaveLength(0);
  });
});
