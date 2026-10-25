import "server-only";
import { z } from "zod";

const text = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(4000).default("");
const date = z.iso.date();
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Waktu harus berformat HH:mm.")
  .default("12:00");
const amount = z.coerce.number().int().positive().max(99_999_999_999_999);
const reason = z
  .string()
  .trim()
  .min(5, "Alasan minimal lima karakter.")
  .max(2000);
const optionalId = z.union([z.uuid(), z.literal("")]).default("");
const memberIds = z
  .array(z.uuid())
  .max(7)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Peserta tidak boleh dipilih dua kali.",
  );
const phone = z
  .string()
  .transform((v) => v.replace(/[\s+()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^[1-9]\d{7,14}$/,
        "Gunakan nomor internasional, misalnya 628123456789.",
      ),
  );
export const commandSchema = z
  .object({
    action: z.enum([
      "period.save",
      "period.transition",
      "period.feature",
      "participant.create",
      "participant.update",
      "participant.assign",
      "participant.cancel",
      "participant.reactivate",
      "group.save",
      "group.add-members",
      "group.lock",
      "group.reopen",
      "group.purchase",
      "group.slaughter",
      "group.cancel",
      "cash.create",
      "cash.void",
      "cash.correct",
      "settings.save",
      "admin.save",
      "admin.toggle",
      "account.password",
    ]),
    id: z.string().max(100).optional(),
    periodId: optionalId,
    requestId: z.uuid(),
    values: z.record(z.string(), z.unknown()),
  })
  .strict();
export type Command = z.infer<typeof commandSchema>;
export const schemas = {
  period: z.object({
    name: text,
    year: z.coerce.number().int().min(1).max(10000),
    start: date,
    end: date,
    due: date,
    date,
    notes: optionalText,
  }),
  transition: z.object({
    status: z.enum(["open", "closed", "completed", "archived"]),
    reason,
  }),
  feature: z.object({ remove: z.boolean().default(false) }),
  registration: z.object({
    existing: optionalId,
    name: z.string().trim().max(200).default(""),
    phone: z.string().max(30).default(""),
    group: optionalId,
    address: optionalText,
    registered: date,
    notes: optionalText,
  }),
  participant: z.object({
    name: text,
    phone,
    address: optionalText,
    notes: optionalText,
  }),
  assignment: z.object({ group: optionalId }),
  reason: z.object({ reason }),
  correction: z.object({
    ids: z
      .array(z.uuid())
      .min(1)
      .max(20)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Transaksi tidak boleh dipilih dua kali.",
      ),
    reason,
    replacement: z
      .object({
        participant: z.uuid(),
        type: z.enum(["deposit", "refund"]),
        amount,
        date,
        time,
        notes: optionalText,
      })
      .optional(),
  }),
  group: z.object({
    name: text,
    breed: z.string().trim().max(100).default(""),
    expected: z.coerce.number().int().min(1).max(7),
    estimate: amount,
    notes: optionalText,
    memberIds: memberIds.default([]),
  }),
  groupMembers: z.object({
    memberIds: memberIds.refine(
      (ids) => ids.length > 0,
      "Pilih peserta terlebih dahulu.",
    ),
  }),
  lock: z.object({ final: amount, reason }),
  purchase: z.object({ cost: amount, date, notes: optionalText }),
  slaughter: z.object({ date }),
  cash: z.object({
    participant: z.uuid(),
    type: z.enum(["deposit", "refund"]),
    amount,
    date,
    time,
    paymentMethod: z.literal("cash").default("cash"),
    notes: optionalText,
  }),
  settings: z.object({
    name: text,
    contact: text,
    whatsapp: z
      .string()
      .max(30)
      .transform((v) => v.replace(/[\s+()-]/g, ""))
      .pipe(z.union([z.literal(""), z.string().regex(/^[1-9]\d{7,14}$/)])),
    description: z.string().trim().min(15).max(4000),
    address: optionalText,
  }),
  admin: z.object({
    name: text,
    email: z.email().trim().toLowerCase(),
    password: z.string().min(12).max(128).optional(),
  }),
  password: z.object({
    current: z.string().min(1).max(128),
    password: z.string().min(12).max(128),
    confirm: z.string().min(12).max(128),
  }),
  phone,
};
export function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const atNoon = (date: string) => new Date(`${date}T12:00:00+07:00`);
export const atCashTime = (date: string, time: string) =>
  new Date(`${date}T${time}:00+07:00`);
