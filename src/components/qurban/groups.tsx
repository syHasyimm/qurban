"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Beef,
  Users,
  LockKeyhole,
  LockKeyholeOpen,
  ShoppingBag,
  CheckCircle2,
  Pencil,
  Ban,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQurban, useViewState } from "./demo-provider";
import { useMobile } from "@/hooks/use-mobile";
import { MobileActions, MobileFilters } from "./mobile-controls";
import { RegistrationFlow } from "./registration-flow";
import {
  GroupParticipantField,
  GroupParticipantForm,
} from "./participant-tags";
import {
  Badge,
  Editor,
  EmptyState,
  Notice,
  PageHeading,
  Panel,
  Progress,
  SearchBox,
  type EditorConfig,
} from "./ui";
import {
  balanceOf,
  dateLabel,
  groupLabels,
  initials,
  money,
  paymentStatus,
  targetOf,
  type Group,
  type Participant,
} from "@/lib/qurban-demo";

export function GroupsView({ id }: { id?: string }) {
  const { state, setState, periodId, base, audit, preview, mutate, busy } =
    useQurban();
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [search, setSearch] = useViewState("kelompok", "search", "");
  const [filter, setFilter] = useViewState("kelompok", "filter", "all");
  const [detailTab, setDetailTab] = useState("summary");
  const mobile = useMobile();
  const searchParams = useSearchParams();
  const period = state.periods.find((p) => p.id === periodId)!;
  const readOnly = ["completed", "archived"].includes(period.status);
  const groups = state.groups.filter((g) => g.periodId === periodId);
  const membersOf = (g: Group) =>
    state.participants.filter((p) => p.groupId === g.id && p.active);
  const participants = state.participants.filter(
    (p) => p.periodId === periodId,
  );
  const waiting = participants.filter((p) => p.active && !p.groupId);
  const chosen = waiting.find((p) => p.id === searchParams.get("peserta"));
  async function saveMembers(
    group: Group,
    memberIds: string[],
    requestId?: string,
  ) {
    if (!preview)
      return mutate(
        "group.add-members",
        { memberIds, _requestId: requestId },
        group.id,
      );
    const error = validateMembers(memberIds, group.expected, group);
    if (error) return error;
    if (
      readOnly ||
      group.locked ||
      !["forming", "collecting"].includes(group.status)
    )
      return "Buka kembali kelompok sebelum mengubah anggota.";
    setState((s) => ({
      ...s,
      participants: s.participants.map((p) =>
        memberIds.includes(p.id) ? { ...p, groupId: group.id } : p,
      ),
    }));
    audit(
      "Peserta ditambahkan ke kelompok",
      `${group.name} · ${memberIds.length} peserta`,
      "Kelompok",
    );
    toast.success("Peserta ditambahkan ke kelompok dalam pratinjau.");
  }
  function addMembers(group: Group) {
    setEditor({
      title: `Tambah peserta ke ${group.name}`,
      description:
        "Pilih data yang sudah didaftarkan di halaman Peserta. Satu peserta hanya dapat menjadi anggota satu kelompok pada periode ini.",
      fields: [],
      renderExtra: () => (
        <GroupParticipantField
          participants={participants}
          members={membersOf(group)}
          capacity={group.expected}
          participantsHref={`${base}/peserta`}
          initialSelected={chosen ? [chosen.id] : []}
        />
      ),
      submit: "Tambahkan ke kelompok",
      save: (v) => {
        const ids: string[] = JSON.parse(v.memberIds || "[]");
        if (!ids.length) return "Pilih minimal satu peserta untuk ditambahkan.";
        return saveMembers(group, ids, v._requestId);
      },
    });
  }
  function removeMember(group: Group, participant: Participant) {
    setEditor({
      title: "Keluarkan peserta dari kelompok",
      description: `${participant.name} akan dikeluarkan dari ${group.name}. Data peserta tetap tersimpan dan dapat dipilih kembali untuk kelompok lain.`,
      fields: [],
      submit: "Keluarkan dari kelompok",
      save: (v) => {
        if (!preview)
          return mutate(
            "participant.assign",
            { ...v, group: "" },
            participant.id,
          );
        if (balanceOf(participant.id, state.transactions) !== 0)
          return "Selesaikan pengembalian seluruh setoran sebelum mengeluarkan peserta.";
        if (readOnly || group.locked)
          return "Buka kembali kelompok sebelum mengubah anggota.";
        setState((s) => ({
          ...s,
          participants: s.participants.map((p) =>
            p.id === participant.id ? { ...p, groupId: "" } : p,
          ),
        }));
        audit("Kelompok peserta diperbarui", participant.name, "Peserta");
        toast.success("Peserta kembali ke daftar belum berkelompok.");
      },
    });
  }
  function validateMembers(ids: string[], capacity: number, group?: Group) {
    if ((group ? membersOf(group).length : 0) + ids.length > capacity)
      return "Jumlah peserta melebihi jumlah anggota disepakati.";
    if (
      new Set(ids).size !== ids.length ||
      ids.some(
        (id) =>
          !participants.some((p) => p.id === id && p.active && !p.groupId),
      )
    )
      return "Pilih peserta aktif dari daftar tunggu pada periode ini.";
  }
  function update(
    group: Group,
    values: Partial<Group>,
    action: string,
    reason = "",
  ) {
    setState((s) => ({
      ...s,
      groups: s.groups.map((g) =>
        g.id === group.id ? { ...g, ...values } : g,
      ),
    }));
    audit(action, `${group.name}${reason ? ` · ${reason}` : ""}`, "Kelompok");
    toast.success(`${action} dalam pratinjau.`);
  }
  function edit(group?: Group) {
    setEditor({
      title: group ? "Ubah kelompok sapi" : "Tambah kelompok sapi",
      description:
        "Isi informasi kelompok, lalu pilih anggota dari data Peserta. Anggota dapat ditambahkan sekarang atau setelah kelompok dibuat.",
      fields: [
        {
          name: "name",
          label: "Nama kelompok",
          value:
            group?.name ?? `Sapi ${String(groups.length + 1).padStart(2, "0")}`,
        },
        {
          name: "breed",
          label: "Jenis sapi",
          value: group?.breed ?? "Sapi limosin",
        },
        {
          name: "expected",
          label: "Jumlah anggota disepakati",
          type: "number",
          min: 1,
          max: 7,
          value: group?.expected ?? 7,
        },
        {
          name: "estimate",
          label: "Estimasi total biaya (Rp)",
          type: "number",
          min: 1,
          value: group?.estimate ?? 28_000_000,
        },
        {
          name: "notes",
          label: "Catatan kesepakatan",
          type: "textarea",
          value: group?.notes ?? "",
          required: false,
        },
      ],
      renderExtra: (values) => (
        <>
          <Notice>
            Estimasi per peserta:{" "}
            <strong>
              {money(
                Math.ceil(
                  Number(values.estimate || group?.estimate || 28000000) /
                    Math.max(
                      1,
                      Number(values.expected || group?.expected || 7),
                    ),
                ),
              )}
            </strong>
            . Pembagi mengikuti jumlah anggota yang disepakati.
          </Notice>
          <GroupParticipantField
            participants={participants}
            members={group ? membersOf(group) : []}
            capacity={Math.max(1, Math.min(7, Number(values.expected) || 1))}
            participantsHref={`${base}/peserta`}
            initialSelected={chosen ? [chosen.id] : []}
          />
        </>
      ),
      save: (v) => {
        const memberIds: string[] = JSON.parse(v.memberIds || "[]");
        if (!preview)
          return mutate("group.save", { ...v, memberIds }, group?.id);
        const expected = Number(v.expected);
        const estimate = Number(v.estimate);
        if (
          !Number.isInteger(expected) ||
          expected < 1 ||
          expected > 7 ||
          !Number.isSafeInteger(estimate) ||
          estimate < 1
        )
          return "Jumlah anggota 1-7 dan biaya berupa rupiah utuh positif.";
        if (group && membersOf(group).length > expected)
          return "Jumlah yang disepakati tidak boleh di bawah jumlah anggota aktif.";
        const error = validateMembers(memberIds, expected, group);
        if (error) return error;
        if (group) {
          update(
            group,
            {
              name: v.name,
              breed: v.breed,
              expected,
              estimate,
              notes: v.notes,
            },
            "Kelompok diperbarui",
          );
          setState((s) => ({
            ...s,
            participants: s.participants.map((p) =>
              memberIds.includes(p.id) ? { ...p, groupId: group.id } : p,
            ),
          }));
          if (memberIds.length)
            audit(
              "Peserta ditambahkan ke kelompok",
              `${group.name} · ${memberIds.length} peserta`,
              "Kelompok",
            );
        } else {
          const item: Group = {
            id: crypto.randomUUID(),
            periodId,
            name: v.name,
            breed: v.breed,
            expected,
            estimate,
            final: 0,
            locked: false,
            status: "forming",
            purchaseCost: 0,
            purchasedOn: "",
            slaughteredOn: "",
            notes: v.notes,
          };
          setState((s) => ({
            ...s,
            groups: [...s.groups, item],
            participants: s.participants.map((p) =>
              memberIds.includes(p.id) ? { ...p, groupId: item.id } : p,
            ),
          }));
          audit("Kelompok dibuat", item.name, "Kelompok");
          toast.success("Kelompok ditambahkan ke pratinjau.");
        }
      },
    });
  }
  function lock(group: Group) {
    if (membersOf(group).length !== group.expected) {
      toast.error(
        `Lengkapi ${group.expected} anggota atau sepakati ulang jumlah anggota terlebih dahulu.`,
      );
      return;
    }
    setEditor({
      title: "Kunci harga dan anggota",
      review: true,
      description:
        "Pastikan total biaya dan komposisi telah disepakati seluruh anggota. Target akan dihitung ulang.",
      fields: [
        {
          name: "final",
          label: "Total biaya final (Rp)",
          type: "number",
          min: 1,
          value: group.estimate,
        },
        {
          name: "reason",
          label: "Catatan kesepakatan / penggunaan pembulatan",
          type: "textarea",
          value:
            "Disepakati seluruh anggota. Selisih pembulatan dicatat dan disepakati penggunaannya.",
        },
      ],
      submit: "Kunci harga dan anggota",
      save: (v) => {
        if (!preview) return mutate("group.lock", v, group.id);
        const final = Number(v.final);
        if (!Number.isSafeInteger(final) || final < 1)
          return "Isi total biaya final dalam rupiah utuh positif.";
        const target = Math.ceil(final / group.expected);
        const ready = membersOf(group).every(
          (p) => balanceOf(p.id, state.transactions) === target,
        );
        update(
          group,
          {
            final,
            locked: true,
            status: ready ? "ready" : "collecting",
            notes: v.reason,
          },
          "Harga dan anggota dikunci",
          v.reason,
        );
      },
    });
  }
  function reopen(group: Group) {
    setEditor({
      title: "Buka kembali kelompok",
      description:
        "Harga dan anggota dapat diubah kembali sebelum pembelian. Sampaikan perubahan target kepada seluruh anggota.",
      fields: [
        { name: "reason", label: "Alasan pembukaan kembali", type: "textarea" },
      ],
      submit: "Buka kembali",
      save: (v) => {
        if (!preview) return mutate("group.reopen", v, group.id);
        if (v.reason.trim().length < 5)
          return "Tulis alasan minimal lima karakter.";
        update(
          group,
          { locked: false, status: "forming" },
          "Kelompok dibuka kembali",
          v.reason,
        );
      },
    });
  }
  function purchase(group: Group) {
    setEditor({
      title: "Catat pembelian sapi",
      review: true,
      description:
        "Harga beli dicatat terpisah dari total kewajiban kelompok. Setelah pembelian, harga dan anggota tidak dapat diubah.",
      fields: [
        {
          name: "cost",
          label: "Harga beli sapi (Rp)",
          type: "number",
          min: 1,
          max: group.final,
          value: group.final,
        },
        {
          name: "date",
          label: "Tanggal pembelian",
          type: "date",
          value: preview
            ? "2027-05-12"
            : new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Jakarta",
              }).format(new Date()),
        },
        {
          name: "notes",
          label: "Catatan pembelian",
          type: "textarea",
          required: false,
        },
      ],
      submit: "Simpan pembelian",
      save: (v) => {
        if (!preview) return mutate("group.purchase", v, group.id);
        const cost = Number(v.cost);
        if (!Number.isSafeInteger(cost) || cost < 1 || cost > group.final)
          return "Harga beli harus positif dan tidak melampaui anggaran final.";
        update(
          group,
          {
            purchaseCost: cost,
            purchasedOn: v.date,
            status: "purchased",
            notes: `${group.notes}\n${v.notes}`,
          },
          "Pembelian sapi dicatat",
        );
      },
    });
  }
  function slaughter(group: Group) {
    setEditor({
      title: "Catat pelaksanaan qurban",
      review: true,
      description: "Tandai hanya setelah sapi benar-benar dikurbankan.",
      fields: [
        {
          name: "date",
          label: "Tanggal pelaksanaan",
          type: "date",
          value: preview
            ? period.date
            : new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Jakarta",
              }).format(new Date()),
        },
      ],
      submit: "Tandai sudah dikurbankan",
      save: (v) => {
        if (!preview) return mutate("group.slaughter", v, group.id);
        if (v.date < group.purchasedOn)
          return "Pelaksanaan tidak boleh mendahului pembelian.";
        update(
          group,
          { status: "slaughtered", slaughteredOn: v.date },
          "Pelaksanaan qurban dicatat",
        );
      },
    });
  }
  function cancel(group: Group) {
    if (
      membersOf(group).length ||
      state.participants.some(
        (p) =>
          p.groupId === group.id && balanceOf(p.id, state.transactions) !== 0,
      )
    ) {
      toast.error(
        "Selesaikan pengembalian dan kepesertaan seluruh anggota sebelum membatalkan kelompok.",
      );
      return;
    }
    setEditor({
      title: "Batalkan kelompok",
      description:
        "Kelompok batal tetap disimpan dalam riwayat dan tidak dihitung sebagai sapi direncanakan.",
      fields: [
        { name: "reason", label: "Alasan pembatalan", type: "textarea" },
      ],
      submit: "Batalkan kelompok",
      save: (v) => {
        if (!preview) return mutate("group.cancel", v, group.id);
        update(group, { status: "cancelled" }, "Kelompok dibatalkan", v.reason);
      },
    });
  }
  const group = id ? groups.find((g) => g.id === id) : undefined;
  if (id && !group)
    return (
      <>
        <PageHeading
          title="Kelompok tidak ditemukan"
          description="Periksa periode yang dipilih atau kembali ke daftar kelompok."
        />
        <Button asChild variant="outline">
          <Link href={`${base}/kelompok`}>Kembali ke kelompok</Link>
        </Button>
      </>
    );
  if (group) {
    const members = membersOf(group);
    const net = members.reduce(
      (n, p) => n + balanceOf(p.id, state.transactions),
      0,
    );
    const total = group.locked ? group.final : group.estimate;
    const rounding = targetOf(group) * group.expected - total;
    const bought = ["purchased", "slaughtered"].includes(group.status);
    return (
      <>
        <Link href={`${base}/kelompok`} className="q-back">
          <ArrowLeft size={15} /> Semua kelompok
        </Link>
        <PageHeading
          title={group.name}
          description={`${group.breed} · ${period.name}`}
          action={<Badge>{groupLabels[group.status]}</Badge>}
        />
        <div className="qm-mobile-only">
          <div className="q-tabs qm-detail-tabs">
            {[
              { id: "summary", label: "Ringkasan" },
              { id: "members", label: "Anggota" },
              { id: "execution", label: "Pelaksanaan" },
            ].map((tab) => (
              <button
                key={tab.id}
                aria-pressed={detailTab === tab.id}
                className={detailTab === tab.id ? "is-active" : ""}
                onClick={() => setDetailTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {mobile && detailTab === "execution" && (
          <Panel title="Pelaksanaan qurban">
            <dl className="q-definition">
              <div>
                <dt>Status</dt>
                <dd>{groupLabels[group.status]}</dd>
              </div>
              <div>
                <dt>Harga beli</dt>
                <dd>
                  {group.purchaseCost
                    ? money(group.purchaseCost)
                    : "Belum dibeli"}
                </dd>
              </div>
              <div>
                <dt>Tanggal pembelian</dt>
                <dd>
                  {group.purchasedOn
                    ? dateLabel(group.purchasedOn)
                    : "Belum dicatat"}
                </dd>
              </div>
              <div>
                <dt>Tanggal pelaksanaan</dt>
                <dd>
                  {group.slaughteredOn
                    ? dateLabel(group.slaughteredOn)
                    : "Belum dicatat"}
                </dd>
              </div>
            </dl>
            {!readOnly && group.status === "purchased" && (
              <div className="q-profile-actions">
                <Button onClick={() => slaughter(group)}>
                  Catat pelaksanaan
                </Button>
              </div>
            )}
          </Panel>
        )}
        <div className="q-detail-grid qm-group-detail" data-view={detailTab}>
          <Panel>
            <div className="q-group-profile">
              <span className="q-big-cow">
                <Beef size={52} strokeWidth={1.2} />
              </span>
              <h2>{group.name}</h2>
              <p>{group.breed}</p>
              <Badge>
                {group.locked ? "Harga terkunci" : "Harga estimasi"}
              </Badge>
            </div>
            <dl className="q-definition">
              <div>
                <dt>Anggota disepakati</dt>
                <dd>
                  {members.length} / {group.expected} jamaah
                </dd>
              </div>
              <div>
                <dt>Total biaya {group.locked ? "final" : "estimasi"}</dt>
                <dd>{money(total)}</dd>
              </div>
              <div>
                <dt>Target per anggota</dt>
                <dd>{money(targetOf(group))}</dd>
              </div>
              <div>
                <dt>Selisih pembulatan</dt>
                <dd>{money(rounding)}</dd>
              </div>
              {bought && (
                <>
                  <div>
                    <dt>Harga beli sapi</dt>
                    <dd>{money(group.purchaseCost)}</dd>
                  </div>
                  <div>
                    <dt>Tanggal pembelian</dt>
                    <dd>{dateLabel(group.purchasedOn)}</dd>
                  </div>
                </>
              )}
              {group.slaughteredOn && (
                <div>
                  <dt>Pelaksanaan</dt>
                  <dd>{dateLabel(group.slaughteredOn)}</dd>
                </div>
              )}
              <div>
                <dt>Catatan</dt>
                <dd>{group.notes || "Belum ada catatan"}</dd>
              </div>
            </dl>
            {!readOnly && group.status !== "cancelled" && (
              <div className="q-profile-actions">
                {mobile && !group.locked && members.length < group.expected && (
                  <Button onClick={() => setDetailTab("members")}>
                    <Plus size={16} />
                    Tambah anggota
                  </Button>
                )}
                {mobile &&
                  !group.locked &&
                  members.length === group.expected && (
                    <Button onClick={() => lock(group)}>
                      Kunci harga dan anggota
                    </Button>
                  )}
                {mobile && group.status === "ready" && (
                  <Button onClick={() => purchase(group)}>
                    Catat pembelian
                  </Button>
                )}
                {mobile && group.status === "purchased" && (
                  <Button onClick={() => slaughter(group)}>
                    Catat pelaksanaan
                  </Button>
                )}
                {mobile && group.locked && group.status === "collecting" && (
                  <Button onClick={() => setDetailTab("members")}>
                    Lihat iuran anggota
                  </Button>
                )}
                <MobileActions
                  title="Tindakan kelompok"
                  description={`${group.name} · ${groupLabels[group.status]}. Pilih tindakan yang akan diperiksa sebelum disimpan.`}
                  label="Tindakan kelompok"
                  icon={false}
                >
                  {!bought &&
                    (!group.locked ? (
                      <>
                        <Button onClick={() => lock(group)}>
                          <LockKeyhole size={15} /> Kunci harga dan anggota
                        </Button>
                        <Button variant="outline" onClick={() => edit(group)}>
                          <Pencil size={15} /> Ubah kelompok
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" onClick={() => reopen(group)}>
                        <LockKeyholeOpen size={15} /> Buka kembali kelompok
                      </Button>
                    ))}
                  {group.status === "ready" && (
                    <Button onClick={() => purchase(group)}>
                      <ShoppingBag size={15} /> Catat pembelian
                    </Button>
                  )}
                  {group.status === "purchased" && (
                    <Button onClick={() => slaughter(group)}>
                      <CheckCircle2 size={15} /> Catat pelaksanaan
                    </Button>
                  )}
                  {!bought && (
                    <Button variant="destructive" onClick={() => cancel(group)}>
                      <Ban size={15} /> Batalkan kelompok
                    </Button>
                  )}
                </MobileActions>
              </div>
            )}
          </Panel>
          <div>
            <Panel
              title="Progres iuran kelompok"
              description="Kesiapan ditentukan dari pelunasan setiap anggota."
            >
              <div className="q-group-funding">
                <strong>
                  {money(net)}
                  <small> dari {money(total)}</small>
                </strong>
                <Progress value={total ? (net / total) * 100 : 0} />
                <p>
                  {
                    members.filter(
                      (p) =>
                        balanceOf(p.id, state.transactions) === targetOf(group),
                    ).length
                  }{" "}
                  dari {group.expected} anggota telah memenuhi target
                </p>
              </div>
            </Panel>
            <Panel
              title="Anggota kelompok"
              description="Maksimal tujuh peserta aktif per sapi"
            >
              <GroupParticipantForm
                key={group.id}
                participants={participants}
                members={members}
                capacity={group.expected}
                participantsHref={`${base}/peserta`}
                disabled={
                  readOnly ||
                  group.locked ||
                  !["forming", "collecting"].includes(group.status)
                }
                onSave={(memberIds, requestId) =>
                  saveMembers(group, memberIds, requestId)
                }
              />
              <div className="q-table-scroll">
                <table className="q-table">
                  <thead>
                    <tr>
                      <th>Anggota</th>
                      <th>Setoran bersih</th>
                      <th>Sisa tagihan</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Kelola anggota</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((p) => (
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
                            </span>
                          </Link>
                        </td>
                        <td>{money(balanceOf(p.id, state.transactions))}</td>
                        <td>
                          {money(
                            Math.max(
                              targetOf(group) -
                                balanceOf(p.id, state.transactions),
                              0,
                            ),
                          )}
                        </td>
                        <td>
                          <Badge>
                            {paymentStatus(p, state.groups, state.transactions)}
                          </Badge>
                        </td>
                        <td>
                          {!readOnly &&
                            !group.locked &&
                            ["forming", "collecting"].includes(
                              group.status,
                            ) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  busy ||
                                  balanceOf(p.id, state.transactions) !== 0
                                }
                                title={
                                  balanceOf(p.id, state.transactions) !== 0
                                    ? "Kembalikan seluruh setoran sebelum mengeluarkan peserta."
                                    : "Data peserta tetap tersimpan setelah dikeluarkan."
                                }
                                aria-label={`Keluarkan ${p.name}`}
                                onClick={() => removeMember(group, p)}
                              >
                                <UserMinus size={14} /> Keluarkan
                              </Button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!members.length && (
                <EmptyState description="Peserta yang ditambahkan ke kelompok akan tampil di sini." />
              )}
            </Panel>
            <Notice>
              {group.locked
                ? "Perubahan target harus disampaikan kepada seluruh anggota. Selesaikan kelebihan setoran dengan pengembalian tunai."
                : "Target masih berupa estimasi. Jumlah anggota harus sesuai kesepakatan sebelum harga dikunci."}
            </Notice>
          </div>
        </div>
        <Editor config={editor} onClose={() => setEditor(null)} />
      </>
    );
  }
  const filtered = groups.filter(
    (g) =>
      `${g.name} ${g.breed}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || g.status === filter),
  );
  return (
    <>
      <PageHeading
        title="Kelompok Sapi"
        description="Buat kelompok sapi, lalu tambahkan anggota dari data peserta yang sudah terdaftar."
        action={
          <Button
            className="q-primary-button"
            disabled={readOnly}
            onClick={() => edit()}
          >
            <Plus size={17} /> Tambah kelompok
          </Button>
        }
      />
      <RegistrationFlow current="groups" base={base} />
      <div className="q-flow-callout">
        <div>
          <strong>
            {chosen
              ? `Pilih kelompok untuk ${chosen.name}`
              : `${waiting.length} peserta belum berkelompok`}
          </strong>
          <p>
            {chosen
              ? "Klik Tambah peserta pada kelompok yang masih tersedia. Peserta ini akan langsung dipilih untuk Anda."
              : waiting.length
                ? "Klik Tambah peserta pada kelompok yang tersedia, lalu pilih nama peserta sebagai tag."
                : "Daftarkan peserta di halaman Peserta agar namanya tersedia saat memilih anggota kelompok."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`${base}/peserta`}>
            Lihat data peserta
            <ArrowUpRight size={15} />
          </Link>
        </Button>
      </div>
      <div className="q-group-stats">
        <span>
          <Beef size={19} />
          <strong>
            {groups.filter((g) => g.status !== "cancelled").length}
          </strong>{" "}
          kelompok aktif
        </span>
        <span>
          <Users size={19} />
          <strong>
            {
              state.participants.filter(
                (p) => p.periodId === periodId && p.groupId && p.active,
              ).length
            }
          </strong>{" "}
          jamaah berkelompok
        </span>
        <span>
          <CheckCircle2 size={19} />
          <strong>
            {
              groups.filter((g) =>
                ["ready", "purchased", "slaughtered"].includes(g.status),
              ).length
            }
          </strong>{" "}
          sapi sudah didanai
        </span>
      </div>
      <div className="q-list-toolbar">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Cari nama kelompok atau jenis sapi…"
        />
        <MobileFilters
          count={filter === "all" ? 0 : 1}
          onReset={() => setFilter("all")}
        >
          <select
            className="q-select"
            aria-label="Filter status kelompok"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Semua status</option>
            {Object.entries(groupLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </MobileFilters>
      </div>
      <div className="q-group-cards">
        {filtered.map((g) => {
          const members = membersOf(g);
          const net = members.reduce(
            (n, p) => n + balanceOf(p.id, state.transactions),
            0,
          );
          const total = g.locked ? g.final : g.estimate;
          return (
            <Panel key={g.id} className="q-group-card">
              <div className="q-group-card-top">
                <span className="q-cow-icon">
                  <Beef size={25} />
                </span>
                <Badge>{groupLabels[g.status]}</Badge>
              </div>
              <h2>{g.name}</h2>
              <p className="q-muted">{g.breed}</p>
              <div className="q-group-members">
                <div className="q-avatar-stack">
                  {members.slice(0, 4).map((p) => (
                    <span className="q-avatar" key={p.id}>
                      {initials(p.name)}
                    </span>
                  ))}
                </div>
                <span>
                  {members.length}/{g.expected} anggota
                </span>
              </div>
              <p className="q-group-seats">
                {g.status === "cancelled"
                  ? "Kelompok dibatalkan"
                  : g.locked
                    ? "Susunan anggota terkunci"
                    : `${Math.max(g.expected - members.length, 0)} tempat tersedia`}
              </p>
              <div className="q-group-card-price">
                <span>Target per anggota</span>
                <strong>{money(targetOf(g))}</strong>
                <small>
                  <LockKeyhole size={12} />
                  {g.locked ? "Harga final" : "Estimasi sementara"}
                </small>
              </div>
              <div className="q-group-card-progress">
                <div>
                  <span>Iuran terkumpul</span>
                  <strong>{Math.round((net / total) * 100)}%</strong>
                </div>
                <Progress value={(net / total) * 100} />
                <p>
                  {money(net)} <span>/ {money(total)}</span>
                </p>
              </div>
              {!readOnly &&
                !g.locked &&
                ["forming", "collecting"].includes(g.status) && (
                  <div className="q-group-add-action">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        busy || members.length >= g.expected || !waiting.length
                      }
                      onClick={() => addMembers(g)}
                    >
                      <Plus size={15} />
                      {members.length >= g.expected
                        ? "Anggota lengkap"
                        : "Tambah peserta"}
                    </Button>
                  </div>
                )}
              <Link
                href={`${base}/kelompok/${g.id}`}
                className="q-group-card-link"
              >
                Lihat detail kelompok <ArrowUpRight size={17} />
              </Link>
            </Panel>
          );
        })}
      </div>
      {!filtered.length && (
        <Panel>
          <EmptyState
            title="Belum ada kelompok yang sesuai"
            description="Tambahkan kelompok atau ubah filter pencarian."
          />
        </Panel>
      )}
      <Notice>
        Kelompok dengan 1-6 anggota dapat difinalisasi setelah jumlah anggota
        dan pembagian biaya disepakati. Semua anggota membayar target yang sama.
      </Notice>
      <Editor config={editor} onClose={() => setEditor(null)} />
    </>
  );
}
