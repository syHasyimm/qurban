"use client";

import { useState, useRef, type ReactNode, type FormEvent } from "react";
import { Search, Inbox, ArrowUpRight, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMobile } from "@/hooks/use-mobile";
import { CashFlow } from "./cash-flow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  const text = String(children);
  const color =
    tone ??
    (/Lunas|Siap|Aktif|dibuka|dibeli|dikurbankan|Selesai|Setoran|Terkunci/.test(
      text,
    )
      ? "green"
      : /Mencicil|Pembentukan|tunggu|pengembalian|Pengumpulan/.test(text)
        ? "amber"
        : /Void|Dibatalkan|Nonaktif/.test(text)
          ? "red"
          : "neutral");
  return (
    <span className={`q-badge q-badge-${color}`}>
      {color === "green" && <Check size={12} />}
      {children}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="q-page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="q-heading-action">{action}</div>}
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`q-panel ${className}`}>
      {title && (
        <div className="q-panel-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function EmptyState({
  title = "Belum ada data",
  description = "Data yang sesuai akan tampil di sini.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="q-empty">
      <span>
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="q-notice">
      <Info size={17} />
      <div>{children}</div>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Cari nama atau nomor peserta…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="q-search">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Hapus pencarian" onClick={() => onChange("")}>
          ×
        </button>
      )}
    </div>
  );
}
export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div
      className="q-progress"
      role="progressbar"
      aria-label={label ?? "Progres iuran"}
      aria-valuenow={Math.round(Math.min(value, 100))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
  icon,
  featured = false,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon: ReactNode;
  featured?: boolean;
}) {
  return (
    <div className={`q-stat ${featured ? "q-stat-featured" : ""}`}>
      <div className="q-stat-label">
        {label}
        <span>{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}
export function TextLink({ children }: { children: ReactNode }) {
  return (
    <span className="q-text-link">
      {children}
      <ArrowUpRight size={15} />
    </span>
  );
}

export type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  min?: number;
  max?: number;
  help?: string;
  hideWhen?: string;
  options?: { value: string; label: string }[];
};
export type EditorConfig = {
  title: string;
  description: string;
  fields: Field[];
  renderExtra?: (values: Record<string, string>) => ReactNode;
  submit?: string;
  review?: boolean;
  participantChoice?: boolean;
  cash?: { type: "deposit" | "refund"; receiptId: () => string | undefined };
  save: (
    values: Record<string, string>,
  ) => string | void | Promise<string | void>;
};
export function Editor({
  config,
  onClose,
}: {
  config: EditorConfig | null;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const mobile = useMobile();
  function close() {
    setDirty(false);
    setDiscard(false);
    onClose();
  }
  function requestClose() {
    if (pending) return;
    if (mobile && dirty) setDiscard(true);
    else close();
  }
  if (config?.cash && mobile)
    return <CashFlow key={config.title} config={config} onClose={close} />;
  return (
    <Dialog
      open={!!config}
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      {config && (
        <DialogContent
          className={`q-editor sm:max-w-[550px] ${config.fields.length <= 2 && !config.renderExtra ? "q-editor-sheet" : ""}`}
          showCloseButton={!pending}
          onInteractOutside={(event) => {
            if (pending || (mobile && dirty)) {
              event.preventDefault();
              if (!pending) setDiscard(true);
            }
          }}
          onEscapeKeyDown={(event) => {
            if (pending || (mobile && dirty)) {
              event.preventDefault();
              if (!pending) setDiscard(true);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {discard ? "Buang perubahan?" : config.title}
            </DialogTitle>
            <DialogDescription>{config.description}</DialogDescription>
          </DialogHeader>
          {discard && (
            <div className="qm-discard">
              <p>
                Isian belum disimpan. Lanjutkan mengisi atau buang perubahan
                ini.
              </p>
              <Button onClick={() => setDiscard(false)}>Lanjut mengisi</Button>
              <Button variant="outline" onClick={close}>
                Buang perubahan
              </Button>
            </div>
          )}
          <div className="q-editor-form-container" hidden={discard}>
            <EditorForm
              key={config.title}
              config={config}
              onClose={close}
              onCancel={requestClose}
              onDirty={() => setDirty(true)}
              onPending={setPending}
            />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
function EditorForm({
  config,
  onClose,
  onPending,
  onCancel,
  onDirty,
}: {
  config: EditorConfig;
  onClose: () => void;
  onPending: (pending: boolean) => void;
  onCancel: () => void;
  onDirty: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [review, setReview] = useState<Record<string, string> | null>(null);
  const mobile = useMobile();
  const requestId = useRef<string | null>(null);
  const [identityMode, setIdentityMode] = useState<
    "choice" | "new" | "existing"
  >("choice");
  const chooseIdentity = mobile && config.participantChoice;
  const submitting = useRef(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      config.fields.map((field) => [field.name, String(field.value ?? "")]),
    ),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    ) as Record<string, string>;
    requestId.current ??= crypto.randomUUID();
    values._requestId = requestId.current;
    if (mobile && config.review && !review) {
      setReview(values);
      return;
    }
    submitting.current = true;
    setPending(true);
    onPending(true);
    setError("");
    try {
      const result = await config.save(values);
      if (result) setError(result);
      else onClose();
    } catch {
      setError("Data belum dapat disimpan. Silakan coba lagi.");
    } finally {
      submitting.current = false;
      setPending(false);
      onPending(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="q-form"
      onClickCapture={(event) => {
        if ((event.target as Element).closest(".q-participant-picker button"))
          onDirty();
      }}
      onChange={(event) => {
        onDirty();
        if (config.renderExtra || config.fields.some((field) => field.hideWhen))
          setFieldValues(
            Object.fromEntries(new FormData(event.currentTarget)) as Record<
              string,
              string
            >,
          );
      }}
    >
      {chooseIdentity && identityMode === "choice" && (
        <div className="qm-identity-choice">
          <h3>Siapa yang akan didaftarkan?</h3>
          <p>
            Gunakan data lama agar identitas jamaah tidak perlu dibuat ulang.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIdentityMode("new")}
          >
            Daftarkan jamaah baru
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!config.fields.some((f) => f.name === "existing")}
            onClick={() => setIdentityMode("existing")}
          >
            Gunakan data jamaah lama
          </Button>
          {!config.fields.some((f) => f.name === "existing") && (
            <small>
              Belum ada jamaah lama yang dapat didaftarkan pada periode ini.
            </small>
          )}
        </div>
      )}
      <fieldset
        disabled={pending}
        className="q-form-fields"
        hidden={!!review || (chooseIdentity && identityMode === "choice")}
      >
        {config.fields
          .filter((field) => !field.hideWhen || !fieldValues[field.hideWhen])
          .filter(
            (field) =>
              !chooseIdentity ||
              ((identityMode !== "new" || field.name !== "existing") &&
                (identityMode !== "existing" || field.hideWhen !== "existing")),
          )
          .map((field) => (
            <label
              key={field.name}
              className={
                field.type === "textarea" ? "q-field q-field-wide" : "q-field"
              }
            >
              <span>
                {field.label}
                {field.required !== false && <b> *</b>}
              </span>
              {field.options ? (
                <select
                  name={field.name}
                  defaultValue={field.value ?? ""}
                  required={
                    chooseIdentity && field.name === "existing"
                      ? true
                      : field.required !== false
                  }
                >
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  defaultValue={field.value}
                  rows={3}
                  required={field.required !== false}
                />
              ) : (
                <input
                  name={field.name}
                  type={field.type ?? "text"}
                  defaultValue={field.value}
                  required={field.required !== false}
                  min={field.min}
                  max={field.max}
                  step={field.type === "number" ? 1 : undefined}
                  autoComplete="off"
                />
              )}
              {field.help && <small>{field.help}</small>}
            </label>
          ))}
        {config.renderExtra?.(fieldValues)}
      </fieldset>
      {review && (
        <div className="qm-review">
          <h3>Periksa sebelum menyimpan</h3>
          <dl>
            {config.fields
              .filter(
                (field) =>
                  field.type !== "password" &&
                  (!field.hideWhen || !review[field.hideWhen]),
              )
              .map((field) => (
                <div key={field.name}>
                  <dt>{field.label}</dt>
                  <dd>
                    {field.options?.find(
                      (option) => option.value === review[field.name],
                    )?.label ??
                      (review[field.name] || "Tidak diisi")}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      )}
      {error && (
        <p className="q-form-error" role="alert">
          {error}
        </p>
      )}
      <div
        className="q-form-actions"
        hidden={chooseIdentity && identityMode === "choice"}
      >
        <Button
          type="button"
          variant="outline"
          onClick={review ? () => setReview(null) : onCancel}
          disabled={pending}
        >
          {review ? "Perbaiki" : "Batal"}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Menyimpan…"
            : mobile && config.review && !review
              ? "Periksa perubahan"
              : (config.submit ?? "Simpan perubahan")}
        </Button>
      </div>
    </form>
  );
}
