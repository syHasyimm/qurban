import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowUpRight,
  HeartHandshake,
  CheckCircle2,
} from "lucide-react";
import { LoginForm } from "@/components/shared/login-form";
export const metadata: Metadata = { title: "Masuk Panitia" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  return (
    <div className="q-login-layout">
      <section className="q-login-story">
        <span className="q-login-icon">
          <HeartHandshake size={38} strokeWidth={1.4} />
        </span>
        <h2>
          Amanah yang baik,
          <br />
          dimulai dari catatan
          <br />
          yang tertib.
        </h2>
        <p>
          Satu ruang untuk mengelola niat baik jamaah, dari setoran pertama
          hingga pelaksanaan qurban.
        </p>
        <div>
          <CheckCircle2 size={17} /> Iuran tercatat. Riwayat terjaga.
        </div>
      </section>
      <section className="q-login-form">
        <span className="q-login-shield">
          <ShieldCheck size={25} />
        </span>
        <h1>Masuk panitia</h1>
        <p>Selamat datang kembali. Lanjutkan pengelolaan qurban Anda.</p>
        <LoginForm
          status={
            search.sesi === "berakhir"
              ? "berakhir"
              : search.akses === "ditolak"
                ? "ditolak"
                : undefined
          }
        />
        <div className="q-login-note">
          <ShieldCheck size={16} />
          <p>
            Akun dibuat oleh admin panitia. Pendaftaran jamaah dilakukan dengan
            menghubungi panitia.
          </p>
        </div>
        <Link href="/preview/dashboard" className="q-login-preview">
          Jelajahi pratinjau frontend <ArrowUpRight size={15} />
        </Link>
      </section>
    </div>
  );
}
