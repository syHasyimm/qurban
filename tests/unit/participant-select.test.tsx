import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantTags } from "@/components/qurban/participant-tags";
import type { Participant } from "@/lib/qurban-demo";

vi.mock("@/hooks/use-mobile", () => ({ useMobile: () => false }));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const participant = (id: string, name: string, groupId = ""): Participant => ({
  id,
  name,
  number: `Q48-${id}`,
  groupId,
  periodId: "1448",
  phone: "6281200000000",
  address: "",
  active: true,
  notes: "",
});
const saved = participant("1", "Anggota Lama", "sapi-03");
const people = [
  saved,
  participant("2", "Ahmad Fauzi"),
  participant("3", "Siti Aminah"),
  participant("4", "Budi Santoso"),
  participant("5", "Sudah Berkelompok", "sapi-02"),
  { ...participant("6", "Peserta Batal"), active: false },
];

function Harness({
  capacity = 3,
  disabled = false,
}: {
  capacity?: number;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <ParticipantTags
      participants={people}
      members={[saved]}
      capacity={capacity}
      disabled={disabled}
      selected={selected}
      onChange={setSelected}
    />
  );
}

describe("multiselect peserta kelompok", () => {
  it("memilih beberapa peserta tanpa menutup daftar dan tidak menggandakan pilihan", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(
      screen.getByRole("button", { name: "Pilih peserta kelompok" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Ahmad Fauzi" }));
    await user.click(screen.getByRole("checkbox", { name: "Siti Aminah" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Ahmad Fauzi" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Siti Aminah" })).toBeChecked();
    expect(
      within(screen.getByRole("group", { name: "Peserta kelompok" })).getByText(
        "3 / 3 peserta",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: "Budi Santoso" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Ahmad Fauzi" }));
    expect(
      screen.getByRole("checkbox", { name: "Budi Santoso" }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Selesai" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Hapus pilihan Ahmad Fauzi" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hapus pilihan Siti Aminah" }),
    ).toBeVisible();
  });

  it("mencari nama atau nomor serta mempertahankan pilihan yang tersembunyi oleh pencarian", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(
      screen.getByRole("button", { name: "Pilih peserta kelompok" }),
    );
    const search = screen.getByRole("searchbox", {
      name: "Cari peserta terdaftar",
    });
    await user.type(search, "Ahmad");
    await user.click(screen.getByRole("checkbox", { name: "Ahmad Fauzi" }));
    expect(search).toHaveValue("Ahmad");
    await user.clear(search);
    await user.type(search, "Q48-3");
    await user.click(screen.getByRole("checkbox", { name: "Siti Aminah" }));
    expect(
      within(screen.getByRole("group", { name: "Peserta kelompok" })).getByText(
        "3 / 3 peserta",
      ),
    ).toBeVisible();
    await user.clear(search);
    await user.type(search, "tidak ada");
    expect(screen.getByText("Peserta tidak ditemukan.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Selesai" }));
    expect(
      screen.getByRole("button", { name: "Hapus pilihan Ahmad Fauzi" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Hapus pilihan Siti Aminah" }),
    ).toBeVisible();
  });

  it("hanya menawarkan peserta aktif belum berkelompok dan menghapus pilihan sementara saja", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(
      screen.getByRole("button", { name: "Pilih peserta kelompok" }),
    );
    expect(
      screen.queryByRole("checkbox", { name: "Sudah Berkelompok" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Peserta Batal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Anggota Lama" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Ahmad Fauzi" }));
    await user.click(screen.getByRole("button", { name: "Hapus pilihan" }));
    expect(
      screen.getByRole("checkbox", { name: "Ahmad Fauzi" }),
    ).not.toBeChecked();
    expect(
      within(screen.getByRole("group", { name: "Peserta kelompok" })).getByText(
        "1 / 3 peserta",
      ),
    ).toBeVisible();
    expect(
      within(screen.getByLabelText("Peserta terpilih")).getByText(
        "Anggota Lama",
      ),
    ).toBeVisible();
  });

  it("mendukung pencarian, panah, spasi, dan escape melalui keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(
      screen.getByRole("button", { name: "Pilih peserta kelompok" }),
    );
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("checkbox", { name: "Ahmad Fauzi" })).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: "Ahmad Fauzi" })).toBeChecked();
    await user.keyboard("{ArrowDown} ");
    expect(screen.getByRole("checkbox", { name: "Siti Aminah" })).toBeChecked();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pilih peserta kelompok" }),
    ).toHaveFocus();
  });

  it("tidak menawarkan perubahan saat kelompok hanya baca", () => {
    render(<Harness disabled />);
    expect(
      screen.queryByRole("button", { name: "Pilih peserta kelompok" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Anggota Lama")).toBeVisible();
  });
});
