"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Checkbox, Popover } from "radix-ui";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMobile } from "@/hooks/use-mobile";
import type { Participant } from "@/lib/qurban-demo";

type Props = {
  participants: Participant[];
  members: Participant[];
  capacity: number;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  participantsHref?: string;
};

export function ParticipantTags({
  participants,
  members,
  capacity,
  selected,
  onChange,
  disabled = false,
  participantsHref,
}: Props) {
  const labelId = useId();
  const helpId = useId();
  const titleId = useId();
  const optionPrefix = useId();
  const mobile = useMobile();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const added = participants.filter(
    (p) => selected.includes(p.id) && !members.some((m) => m.id === p.id),
  );
  const count = members.length + added.length;
  const full = count >= capacity;
  const waiting = participants.filter((p) => p.active && !p.groupId);
  const matches = waiting.filter((p) =>
    `${p.name} ${p.number}`
      .toLocaleLowerCase("id")
      .includes(query.trim().toLocaleLowerCase("id")),
  );
  function toggle(id: string) {
    if (disabled) return;
    if (selected.includes(id))
      onChange(selected.filter((value) => value !== id));
    else if (!full && waiting.some((p) => p.id === id))
      onChange([...selected, id]);
  }
  function changeOpen(value: boolean) {
    if (disabled) return;
    setOpen(value);
    if (value) setQuery("");
  }
  function moveFocus(event: KeyboardEvent<HTMLUListElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const options = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="checkbox"]:not(:disabled)',
      ) ?? [],
    );
    if (!options.length) return;
    event.preventDefault();
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
            options.length;
    options[next].focus();
  }
  const trigger = (
    <button
      type="button"
      className="q-ms-trigger"
      aria-label="Pilih peserta kelompok"
      aria-describedby={helpId}
      disabled={disabled}
    >
      <Users size={17} />
      <span>
        {added.length ? "Tambah atau ubah pilihan" : "Pilih peserta terdaftar…"}
      </span>
      <ChevronDown size={17} />
    </button>
  );
  const picker = (
    <>
      <div className="q-ms-search-wrap">
        <label className="q-ms-search">
          <Search size={17} />
          <input
            ref={searchRef}
            type="search"
            aria-label="Cari peserta terdaftar"
            placeholder="Cari nama atau nomor peserta…"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                listRef.current
                  ?.querySelector<HTMLButtonElement>(
                    'button[role="checkbox"]:not(:disabled)',
                  )
                  ?.focus();
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const first = matches.find((p) => !selected.includes(p.id));
                if (first && !full) toggle(first.id);
              }
            }}
          />
        </label>
        <p
          className={`q-ms-selection-status ${count > capacity ? "is-over" : ""}`}
          role="status"
        >
          {count > capacity
            ? `Pilihan melebihi kapasitas sebanyak ${count - capacity} peserta.`
            : full
              ? "Kapasitas terpenuhi. Hapus centang untuk mengganti pilihan."
              : `${Math.max(capacity - count, 0)} tempat tersedia · Centang beberapa peserta sekaligus.`}
        </p>
      </div>
      <ul
        ref={listRef}
        className="q-ms-options"
        aria-label="Peserta daftar tunggu"
        onKeyDown={moveFocus}
      >
        {matches.map((p) => {
          const checked = selected.includes(p.id);
          const blocked = !checked && full;
          return (
            <li
              key={p.id}
              className={`q-ms-option ${checked ? "is-selected" : ""} ${blocked ? "is-disabled" : ""}`}
            >
              <Checkbox.Root
                className="q-ms-checkbox"
                id={`${optionPrefix}-${p.id}`}
                checked={checked}
                aria-label={p.name}
                disabled={blocked || disabled}
                onCheckedChange={() => toggle(p.id)}
              >
                <Checkbox.Indicator>
                  <Check size={14} strokeWidth={2.5} />
                </Checkbox.Indicator>
              </Checkbox.Root>
              <label htmlFor={`${optionPrefix}-${p.id}`}>
                <strong>{p.name}</strong>
                <small>{p.number}</small>
              </label>
              {checked ? (
                <span className="q-ms-option-status">Dipilih</span>
              ) : blocked ? (
                <span className="q-ms-option-status">Penuh</span>
              ) : null}
            </li>
          );
        })}
        {!matches.length && (
          <li className="q-ms-empty">
            <Users size={24} />
            <strong>
              {waiting.length
                ? "Peserta tidak ditemukan."
                : "Belum ada peserta yang tersedia"}
            </strong>
            <p>
              {waiting.length
                ? "Coba nama atau nomor peserta lain."
                : "Semua peserta yang tersedia sudah dipilih atau dikelompokkan."}
            </p>
          </li>
        )}
      </ul>
      <div className="q-ms-footer">
        <span>{added.length} peserta dipilih</span>
        <div>
          <button
            type="button"
            className="q-ms-clear"
            disabled={!added.length}
            onClick={() => onChange([])}
          >
            Hapus pilihan
          </button>
          <Button type="button" onClick={() => setOpen(false)}>
            Selesai
          </Button>
        </div>
      </div>
    </>
  );
  return (
    <div
      className="q-participant-picker"
      role="group"
      aria-labelledby={labelId}
    >
      <div className="q-tag-heading">
        <span id={labelId}>Peserta kelompok</span>
        <span
          className={count > capacity ? "q-tag-over" : ""}
          aria-live="polite"
        >
          {count} / {capacity} peserta
        </span>
      </div>
      <div
        className={`q-ms-control ${disabled ? "is-readonly" : ""} ${open ? "is-open" : ""} ${count > capacity ? "is-over" : ""}`}
      >
        <div className="q-member-tags" aria-label="Peserta terpilih">
          {members.map((p) => (
            <span
              className="q-member-tag q-member-tag-saved"
              key={p.id}
              title={`${p.number} · Sudah menjadi anggota`}
            >
              <Check size={13} aria-hidden="true" />
              <span>{p.name}</span>
            </span>
          ))}
          {added.map((p) => (
            <span className="q-member-tag" key={p.id}>
              <span>{p.name}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Hapus pilihan ${p.name}`}
                onClick={() => onChange(selected.filter((id) => id !== p.id))}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
        {!disabled &&
          (mobile ? (
            <Dialog open={open} onOpenChange={changeOpen}>
              <DialogTrigger asChild>{trigger}</DialogTrigger>
              <DialogContent
                className="qm-overlay qm-sheet q-ms-mobile"
                showCloseButton={false}
                onOpenAutoFocus={(event) => {
                  event.preventDefault();
                  headingRef.current?.focus();
                }}
                onEscapeKeyDown={(event) => event.stopPropagation()}
              >
                <DialogHeader className="qm-overlay-heading">
                  <div>
                    <DialogTitle ref={headingRef} tabIndex={-1}>
                      Pilih peserta kelompok
                    </DialogTitle>
                    <DialogDescription>
                      Anggota saat ini {members.length} · Kapasitas {capacity}{" "}
                      peserta
                    </DialogDescription>
                  </div>
                  <button
                    type="button"
                    className="qm-icon-button"
                    aria-label="Tutup pilihan peserta"
                    onClick={() => setOpen(false)}
                  >
                    <X size={21} />
                  </button>
                </DialogHeader>
                {picker}
              </DialogContent>
            </Dialog>
          ) : (
            <Popover.Root open={open} onOpenChange={changeOpen}>
              <Popover.Trigger asChild>{trigger}</Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="q-ms-popover"
                  sideOffset={8}
                  collisionPadding={16}
                  align="start"
                  aria-labelledby={titleId}
                  onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    searchRef.current?.focus({ preventScroll: true });
                  }}
                  onEscapeKeyDown={(event) => event.stopPropagation()}
                >
                  <div className="q-ms-panel-heading">
                    <strong id={titleId}>Pilih peserta kelompok</strong>
                    <span>
                      {count} / {capacity} peserta
                    </span>
                  </div>
                  {picker}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          ))}
      </div>
      {!disabled && (
        <>
          <p className="q-tag-help" id={helpId}>
            {count > capacity
              ? "Jumlah pilihan melebihi kapasitas. Hapus pilihan atau sesuaikan jumlah anggota."
              : "Data diambil dari halaman Peserta. Pilih peserta aktif yang belum berkelompok pada periode ini."}
          </p>
          {participantsHref && (
            <Link href={participantsHref} className="q-tag-directory-link">
              Lihat data peserta <ArrowUpRight size={13} />
            </Link>
          )}
        </>
      )}
    </div>
  );
}

export function GroupParticipantField({
  initialSelected = [],
  ...props
}: Omit<Props, "selected" | "onChange"> & { initialSelected?: string[] }) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  return (
    <div className="q-field-wide">
      <ParticipantTags {...props} selected={selected} onChange={setSelected} />
      <input type="hidden" name="memberIds" value={JSON.stringify(selected)} />
    </div>
  );
}

export function GroupParticipantForm({
  onSave,
  ...props
}: Omit<Props, "selected" | "onChange"> & {
  onSave: (ids: string[], requestId: string) => Promise<string | void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  return (
    <form
      className="q-group-participant-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!selected.length || submitting.current || props.disabled) return;
        submitting.current = true;
        setPending(true);
        setError("");
        requestId.current ??= crypto.randomUUID();
        try {
          const message = await onSave(selected, requestId.current);
          if (message) setError(message);
          else {
            setSelected([]);
            requestId.current = null;
          }
        } catch {
          setError("Peserta belum dapat ditambahkan. Silakan coba lagi.");
        } finally {
          submitting.current = false;
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending}>
        <ParticipantTags
          {...props}
          disabled={props.disabled || pending}
          selected={selected}
          onChange={(ids) => {
            setSelected(ids);
            requestId.current = null;
            setError("");
          }}
        />
        {!!selected.length && !props.disabled && (
          <div className="q-tag-actions">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setSelected([]);
                setError("");
                requestId.current = null;
              }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={
                pending ||
                props.members.length + selected.length > props.capacity
              }
            >
              <Plus size={15} />
              {pending ? "Menyimpan…" : `Tambah ${selected.length} peserta`}
            </Button>
          </div>
        )}
      </fieldset>
      {error && (
        <p className="q-form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
