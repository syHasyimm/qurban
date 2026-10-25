"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Beef,
  Wallet,
  ChartNoAxesCombined,
  Globe,
  ShieldCheck,
  History,
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
  HelpCircle,
  FlaskConical,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { LogoutButton } from "@/components/shared/logout-button";
import { DemoProvider, useQurban } from "@/components/qurban/demo-provider";
import { initials, menuItems, type DemoState } from "@/lib/qurban-demo";
import { MobileShell } from "@/components/qurban/mobile-shell";
import { useMobile } from "@/hooks/use-mobile";

const icons = [
  LayoutDashboard,
  CalendarDays,
  Users,
  Beef,
  Wallet,
  ChartNoAxesCombined,
  Globe,
  ShieldCheck,
  History,
];
function DashboardFrame({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mobile = useMobile();
  const {
    state,
    periodId,
    setPeriodId,
    base,
    preview,
    syncError,
    refresh,
    busy,
    viewState,
  } = useQurban();
  const active = menuItems.find((item) =>
    pathname.startsWith(`${base}/${item.slug}`),
  );
  const period = state.periods.find((item) => item.id === periodId)!;
  useEffect(() => {
    const saved = viewState.current.get(`scroll:${periodId}:${pathname}`);
    if (typeof saved !== "number") return;
    const frame = requestAnimationFrame(() =>
      window.scrollTo({ top: saved, behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [pathname, periodId, viewState]);
  return (
    <div
      className="q-app"
      data-section={active?.slug}
      onClickCapture={(event) => {
        if ((event.target as Element).closest("a[href]"))
          viewState.current.set(
            `scroll:${periodId}:${pathname}`,
            window.scrollY,
          );
      }}
    >
      {open && (
        <button
          className="q-sidebar-scrim"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`q-sidebar ${open ? "is-open" : ""}`}>
        <Link
          href={base ? `${base}/dashboard` : "/"}
          className="q-sidebar-brand"
        >
          <Image src="/logo.png" alt="" width={46} height={46} />
          <span>
            Qurban<span className="q-brand-dot">.</span>
            <small>Ruang Panitia</small>
          </span>
        </Link>
        <button
          className="q-mobile-close"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
        >
          <X size={21} />
        </button>
        <div className="q-workspace">
          <span className="q-workspace-icon">
            <Beef size={20} />
          </span>
          <div>
            <strong>{state.settings.name}</strong>
            <small>Pengelolaan qurban</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <p className="q-nav-label">MENU UTAMA</p>
        <nav id="dashboard-navigation" aria-label="Menu panitia">
          {menuItems.map((item, i) => {
            const Icon = icons[i];
            return (
              <Link
                key={item.slug}
                href={`${base}/${item.slug}`}
                onClick={() => setOpen(false)}
                className={`q-nav-item ${active?.slug === item.slug ? "is-active" : ""}`}
                aria-current={active?.slug === item.slug ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{item.label}</span>
                {item.slug === "peserta" && (
                  <b>
                    {
                      state.participants.filter(
                        (p) => p.periodId === periodId && p.active,
                      ).length
                    }
                  </b>
                )}
                {active?.slug === item.slug && (
                  <ChevronRight size={15} className="q-nav-arrow" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="q-sidebar-bottom">
          <div className="q-sidebar-help">
            <HelpCircle size={21} />
            <strong>Satu niat, banyak kebaikan.</strong>
            <p>Kelola amanah jamaah dengan rapi dan terbuka.</p>
            <Link href="/">
              Lihat halaman publik <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="q-sidebar-user">
            <span className="q-avatar">{initials(state.accounts[0].name)}</span>
            <div>
              <strong>{state.accounts[0].name}</strong>
              <small>Admin panitia</small>
            </div>
            {preview ? (
              <Link href="/login" aria-label="Keluar dari pratinjau">
                <LogOut size={17} />
              </Link>
            ) : (
              <LogoutButton />
            )}
          </div>
        </div>
      </aside>
      <div className="q-app-body">
        {mobile && <MobileShell />}
        <header className="q-topbar">
          <div className="q-breadcrumb">
            <button
              className="q-mobile-menu"
              aria-label="Buka menu"
              aria-expanded={open}
              aria-controls="dashboard-navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>Ruang Panitia</span>
            <ChevronRight size={14} />
            <strong>{active?.label ?? "Dashboard"}</strong>
          </div>
          <div className="q-topbar-actions">
            <Link href="/" className="q-public-link">
              Halaman publik <ArrowUpRight size={14} />
            </Link>
            <span className="q-avatar q-top-avatar">
              {initials(state.accounts[0].name)}
            </span>
          </div>
        </header>
        {preview && (
          <div className="q-preview-banner">
            <FlaskConical size={15} />
            <span>
              <strong>Pratinjau frontend.</strong> Data contoh; perubahan
              direset saat halaman dimuat ulang.
            </span>
            {!preview && (
              <Link href="/preview/dashboard">
                Buka pratinjau <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
        )}
        {syncError && (
          <div className="q-preview-banner" role="alert">
            {syncError}
            <button onClick={() => void refresh()} disabled={busy}>
              Coba lagi
            </button>
          </div>
        )}
        <div className="q-period-bar">
          <div>
            <span className="q-period-indicator" />
            Periode pengelolaan
            <select
              aria-label="Pilih periode pengelolaan"
              value={periodId}
              disabled={!state.periods.length || busy}
              onChange={(e) => setPeriodId(e.target.value)}
            >
              {!state.periods.length && (
                <option value="">Belum ada periode</option>
              )}
              {state.periods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
          <span className="q-period-status">
            {!period
              ? "Siapkan periode pertama"
              : period.status === "open"
                ? "Pendaftaran dibuka"
                : period.status === "draft"
                  ? "Periode draf"
                  : period.status === "archived"
                    ? "Arsip · hanya baca"
                    : period.status === "completed"
                      ? "Selesai · hanya baca"
                      : "Pendaftaran ditutup"}
          </span>
        </div>
        <main id="main-content" className="q-main">
          {children}
        </main>
        <footer className="q-app-footer">
          <span>Qurban. Berawal dari niat baik.</span>
          <span>Amanah dalam setiap catatan.</span>
        </footer>
      </div>
    </div>
  );
}
export function DashboardShell({
  children,
  preview = false,
  initialState,
}: {
  children: React.ReactNode;
  preview?: boolean;
  initialState?: DemoState;
}) {
  return (
    <DemoProvider preview={preview} initialState={initialState}>
      <DashboardFrame>{children}</DashboardFrame>
    </DemoProvider>
  );
}
