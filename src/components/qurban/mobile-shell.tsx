"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Beef,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  HandCoins,
  History,
  House,
  LayoutGrid,
  LogOut,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/shared/logout-button";
import { useQurban } from "./demo-provider";
import { initials, menuItems, periodLabels } from "@/lib/qurban-demo";

const services = [
  { slug: "peserta", label: "Peserta", icon: Users },
  { slug: "kelompok", label: "Kelompok sapi", icon: Beef },
  { slug: "iuran", label: "Iuran tunai", icon: Wallet },
  { slug: "periode", label: "Periode", icon: CalendarDays },
  { slug: "laporan", label: "Laporan", icon: ChartNoAxesCombined },
  { slug: "aktivitas", label: "Aktivitas", icon: History },
];

export function MobileShell() {
  const { state, periodId, setPeriodId, base, preview, busy } = useQurban();
  const pathname = usePathname();
  const router = useRouter();
  const [overlay, setOverlay] = useState<"menu" | "period" | "logout" | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () =>
      document.documentElement.style.setProperty(
        "--qm-visible-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
    resize();
    viewport?.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      document.documentElement.style.removeProperty("--qm-visible-height");
    };
  }, []);
  const period = state.periods.find((p) => p.id === periodId);
  const account = state.accounts[0]; // loadState places the authenticated account first.
  const section = menuItems.find((item) =>
    pathname.startsWith(`${base}/${item.slug}`),
  );
  const home = section?.slug === "dashboard";
  const detail =
    pathname.slice(base.length).split("/").filter(Boolean).length > 1;
  const secondary = !["dashboard", "peserta", "iuran"].includes(
    section?.slug ?? "",
  );
  const name = account?.name ?? "Panitia";
  const canRecord = !!period && ["open", "closed"].includes(period.status);
  const open = (value: "menu" | "period", target: HTMLButtonElement) => {
    triggerRef.current = target;
    setOverlay(value);
  };
  return (
    <>
      <header className={`qm-header ${home ? "qm-header-home" : ""}`}>
        <div className="qm-header-row">
          {home ? (
            <Link href={`${base}/dashboard`} className="qm-brand">
              <Image src="/logo.png" width={34} height={34} alt="" />
              <span>
                Qurban<span>.</span>
              </span>
            </Link>
          ) : (
            <>
              <Link
                className="qm-icon-button"
                href={detail ? `${base}/${section?.slug}` : `${base}/dashboard`}
                aria-label={
                  detail ? `Kembali ke ${section?.label}` : "Kembali ke beranda"
                }
              >
                <ArrowLeft size={21} />
              </Link>
              <span className="qm-header-title">
                {section?.label ?? "Ruang panitia"}
              </span>
            </>
          )}
          <button
            className="qm-profile"
            aria-label="Buka profil dan menu"
            onClick={(e) => open("menu", e.currentTarget)}
          >
            {initials(name)}
          </button>
        </div>
        {home && (
          <p className="qm-greeting">
            Assalamu’alaikum, <strong>{name.split(/\s+/)[0]}</strong>
            <span>Semoga hari ini penuh kebaikan.</span>
          </p>
        )}
        <button
          className="qm-period-trigger"
          onClick={(e) => open("period", e.currentTarget)}
          disabled={busy}
          aria-label="Pilih periode pengelolaan mobile"
        >
          <span>
            <CalendarDays size={15} />
            {period?.name ?? "Siapkan periode pertama"}
          </span>
          <ChevronDown size={16} />
        </button>
        {!home && period && (
          <span className="qm-period-caption">
            {periodLabels[period.status]}
            {["completed", "archived"].includes(period.status)
              ? " · Hanya baca"
              : ""}
          </span>
        )}
      </header>

      <nav className="qm-bottom-nav" aria-label="Navigasi aplikasi mobile">
        <Link
          href={`${base}/dashboard`}
          aria-current={home ? "page" : undefined}
          className={home ? "is-active" : ""}
        >
          <House size={22} />
          <span>Beranda</span>
        </Link>
        <Link
          href={`${base}/peserta`}
          aria-current={section?.slug === "peserta" ? "page" : undefined}
          className={section?.slug === "peserta" ? "is-active" : ""}
        >
          <Users size={22} />
          <span>Peserta</span>
        </Link>
        <button
          className="qm-setor"
          disabled={!canRecord || busy}
          title={
            canRecord
              ? "Catat setoran tunai"
              : "Periode belum menerima transaksi"
          }
          onClick={() => {
            router.push(
              `${base}/iuran?baru=1&kembali=${encodeURIComponent(pathname.slice(base.length))}`,
            );
          }}
        >
          <span className="qm-setor-icon">
            <HandCoins size={26} />
          </span>
          <span>Setor</span>
        </button>
        <Link
          href={`${base}/iuran`}
          aria-current={section?.slug === "iuran" ? "page" : undefined}
          className={section?.slug === "iuran" ? "is-active" : ""}
        >
          <History size={22} />
          <span>Riwayat</span>
        </Link>
        <button
          className={secondary || overlay === "menu" ? "is-active" : ""}
          aria-label="Semua menu"
          onClick={(e) => open("menu", e.currentTarget)}
        >
          <LayoutGrid size={22} />
          <span>Menu</span>
        </button>
      </nav>

      <Dialog
        open={!!overlay}
        onOpenChange={(value) => {
          if (!value) setOverlay(null);
        }}
      >
        <DialogContent
          className={`qm-overlay ${overlay === "period" || overlay === "logout" ? "qm-sheet" : "qm-menu-screen"}`}
          showCloseButton={false}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <DialogHeader className="qm-overlay-heading">
            <DialogTitle>
              {overlay === "period"
                ? "Pilih periode"
                : overlay === "logout"
                  ? "Keluar dari akun?"
                  : "Semua menu"}
            </DialogTitle>
            <button
              className="qm-icon-button"
              onClick={() => setOverlay(null)}
              aria-label="Tutup"
            >
              <X size={22} />
            </button>
            <DialogDescription className="sr-only">
              {overlay === "period"
                ? "Pilih periode yang ingin dikelola."
                : overlay === "logout"
                  ? "Anda perlu masuk kembali untuk mengelola qurban."
                  : "Layanan dan pengaturan panitia qurban."}
            </DialogDescription>
          </DialogHeader>
          {overlay === "menu" && (
            <div className="qm-menu-body">
              <Link
                href={`${base}/akun-panitia`}
                className="qm-account-card"
                onClick={() => setOverlay(null)}
              >
                <span className="q-avatar">{initials(name)}</span>
                <span>
                  <strong>{name}</strong>
                  <small>Admin panitia{preview ? " · Akun contoh" : ""}</small>
                </span>
                <ChevronRight size={18} />
              </Link>
              <p className="qm-section-label">PENGELOLAAN</p>
              <div className="qm-service-grid">
                {services.map(({ slug, label, icon: Icon }) => (
                  <Link
                    key={slug}
                    href={`${base}/${slug}`}
                    onClick={() => setOverlay(null)}
                  >
                    <span>
                      <Icon size={24} strokeWidth={1.7} />
                    </span>
                    {label}
                  </Link>
                ))}
              </div>
              <p className="qm-section-label">PENGATURAN</p>
              <div className="qm-menu-list">
                <Link
                  href={`${base}/informasi-publik`}
                  onClick={() => setOverlay(null)}
                >
                  <Globe size={20} />
                  <span>Informasi publik</span>
                  <ChevronRight size={17} />
                </Link>
                <Link
                  href={`${base}/akun-panitia`}
                  onClick={() => setOverlay(null)}
                >
                  <ShieldCheck size={20} />
                  <span>Akun panitia</span>
                  <ChevronRight size={17} />
                </Link>
                <Link href="/" onClick={() => setOverlay(null)}>
                  <ArrowUpRight size={20} />
                  <span>Lihat halaman publik</span>
                  <ChevronRight size={17} />
                </Link>
              </div>
              <button
                className="qm-logout"
                onClick={() => setOverlay("logout")}
              >
                <LogOut size={19} />
                {preview ? "Keluar dari pratinjau" : "Keluar dari akun"}
              </button>
              <p className="qm-menu-footnote">Amanah dalam setiap catatan.</p>
            </div>
          )}
          {overlay === "period" && (
            <div className="qm-period-options">
              {[false, true].map((historical) => (
                <div key={String(historical)}>
                  <p className="qm-section-label">
                    {historical ? "RIWAYAT & ARSIP" : "BERJALAN & DRAF"}
                  </p>
                  {state.periods
                    .filter(
                      (p) =>
                        ["completed", "archived"].includes(p.status) ===
                        historical,
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        disabled={busy}
                        aria-pressed={p.id === periodId}
                        onClick={() => {
                          setPeriodId(p.id);
                          if (detail)
                            router.replace(`${base}/${section?.slug}`);
                          setOverlay(null);
                        }}
                      >
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {periodLabels[p.status]}
                            {historical ? " · Hanya baca" : ""}
                          </small>
                        </span>
                        {p.id === periodId ? (
                          <Check size={20} />
                        ) : (
                          <ChevronRight size={17} />
                        )}
                      </button>
                    ))}
                </div>
              ))}
              {!state.periods.length && (
                <p>
                  Belum ada periode. Buat periode pertama untuk mulai mengelola
                  qurban.
                </p>
              )}
              <Button asChild variant="outline">
                <Link href={`${base}/periode`} onClick={() => setOverlay(null)}>
                  Kelola periode <ChevronRight size={16} />
                </Link>
              </Button>
            </div>
          )}
          {overlay === "logout" && (
            <div className="qm-logout-confirm">
              <p>
                Masuk kembali untuk melanjutkan pengelolaan qurban. Perubahan
                yang sudah tersimpan tetap aman.
              </p>
              {preview ? (
                <Button asChild>
                  <Link href="/login">Keluar dari pratinjau</Link>
                </Button>
              ) : (
                <LogoutButton />
              )}
              <Button variant="outline" onClick={() => setOverlay("menu")}>
                Kembali ke menu
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
