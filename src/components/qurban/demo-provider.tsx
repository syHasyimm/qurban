"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
} from "react";
import { createDemoState, type DemoState } from "@/lib/qurban-demo";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type DemoContextValue = {
  state: DemoState;
  setState: Dispatch<SetStateAction<DemoState>>;
  periodId: string;
  setPeriodId: (id: string) => void;
  base: string;
  preview: boolean;
  busy: boolean;
  syncError: string;
  refresh: () => Promise<void>;
  viewState: MutableRefObject<Map<string, unknown>>;
  mutate: (
    action: string,
    values: Record<string, unknown>,
    id?: string,
    targetPeriod?: string,
    onSuccess?: (result: { id?: string; receipt?: string }) => void,
  ) => Promise<string | void>;
  audit: (
    action: string,
    detail: string,
    category: string,
    auditPeriodId?: string,
  ) => void;
};
const DemoContext = createContext<DemoContextValue | null>(null);
export function DemoProvider({
  children,
  preview = false,
  initialState,
}: {
  children: React.ReactNode;
  preview?: boolean;
  initialState?: DemoState;
}) {
  const router = useRouter();
  const [state, setState] = useState(() =>
    preview ? createDemoState() : initialState!,
  );
  const [periodId, setPeriodId] = useState(() =>
    preview
      ? "1448"
      : (initialState?.periods.find((p) => p.status === "open")?.id ??
        initialState?.periods[0]?.id ??
        ""),
  );
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState("");
  const saving = useRef(false);
  const revision = useRef(0);
  const viewState = useRef(new Map<string, unknown>());
  async function refresh() {
    if (preview || saving.current) return;
    const version = ++revision.current;
    try {
      const response = await fetch("/api/qurban", { cache: "no-store" });
      if ([401, 403].includes(response.status)) {
        router.replace(
          response.status === 401
            ? "/login?sesi=berakhir"
            : "/login?akses=ditolak",
        );
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error("refresh");
      const data: DemoState = await response.json();
      if (!saving.current && version === revision.current) {
        setState(data);
        setSyncError("");
      }
    } catch {
      if (version === revision.current)
        setSyncError(
          "Data belum dapat diperbarui. Periksa koneksi dan coba lagi.",
        );
    }
  }
  useEffect(() => {
    if (preview) return;
    const update = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", update);
    const timer = window.setInterval(update, 30000);
    return () => {
      window.removeEventListener("focus", update);
      window.clearInterval(timer);
    };
    // Only installs listeners; refresh reads no period or data state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);
  async function mutate(
    action: string,
    values: Record<string, unknown>,
    id?: string,
    targetPeriod = periodId,
    onSuccess?: (result: { id?: string; receipt?: string }) => void,
  ): Promise<string | void> {
    if (preview) return "Gunakan formulir data contoh dalam mode pratinjau.";
    if (saving.current) return "Tunggu permintaan sebelumnya selesai.";
    saving.current = true;
    revision.current++;
    setBusy(true);
    setSyncError("");
    try {
      const { _requestId, ...payload } = values;
      const response = await fetch("/api/qurban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          values: payload,
          id,
          periodId: targetPeriod,
          requestId:
            typeof _requestId === "string" ? _requestId : crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          router.replace(
            response.status === 401
              ? "/login?sesi=berakhir"
              : "/login?akses=ditolak",
          );
          router.refresh();
        }
        return result.error ?? "Data belum dapat disimpan.";
      }
      if (result.result?.reauthenticate) {
        toast.success("Perubahan disimpan. Silakan masuk kembali.");
        router.replace("/login");
        router.refresh();
        return;
      }
      setState(result.state);
      onSuccess?.(result.result ?? {});
      setPeriodId((current) =>
        result.state.periods.some((p: { id: string }) => p.id === current)
          ? current
          : (result.state.periods[0]?.id ?? ""),
      );
      toast.success(
        result.result?.replayed
          ? "Transaksi sebelumnya sudah tersimpan. Tidak ada pencatatan ganda."
          : "Perubahan berhasil disimpan.",
      );
    } catch {
      return "Koneksi terputus. Coba simpan kembali; formulir ini memakai kunci transaksi yang sama.";
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function audit(
    action: string,
    detail: string,
    category: string,
    auditPeriodId = periodId,
  ) {
    if (!preview) return;
    setState((current) => ({
      ...current,
      activities: [
        {
          id: crypto.randomUUID(),
          action,
          detail,
          category,
          actor: state.accounts[0].name,
          date: new Date().toISOString(),
          periodId: auditPeriodId,
        },
        ...current.activities,
      ],
    }));
  }
  return (
    <DemoContext.Provider
      value={{
        state,
        setState,
        periodId,
        setPeriodId,
        base: preview ? "/preview" : "",
        preview,
        busy,
        syncError,
        refresh,
        viewState,
        mutate,
        audit,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useQurban() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("Qurban provider is required");
  return value;
}

// Kept in the current provider only: no participant data is persisted in storage.
export function useViewState<T>(
  section: string,
  field: string,
  initial: T,
  override?: T,
) {
  const { viewState, periodId } = useQurban();
  const key = `${periodId}:${section}:${field}`;
  const [value, setValue] = useState<T>(
    () =>
      override ??
      (viewState.current.has(key)
        ? (viewState.current.get(key) as T)
        : initial),
  );
  const update: Dispatch<SetStateAction<T>> = (next) => {
    setValue((previous) => {
      const resolved =
        typeof next === "function" ? (next as (value: T) => T)(previous) : next;
      viewState.current.set(key, resolved);
      return resolved;
    });
  };
  return [value, update] as const;
}
