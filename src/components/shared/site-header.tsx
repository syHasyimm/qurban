import Link from "next/link";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="q-site-header">
      <div className="q-site-header-inner">
        <Brand />
        <nav aria-label="Navigasi utama" className="q-site-nav">
          <div className="q-site-nav-links">
            <Link href="/#tentang">Tentang program</Link>
            <Link href="/#cara-bergabung">Cara bergabung</Link>
            <Link href="/#jadwal">Jadwal</Link>
          </div>
          <Button asChild variant="outline" className="h-10 px-4">
            <Link href="/login">Masuk panitia</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
