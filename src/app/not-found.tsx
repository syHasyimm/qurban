import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 px-6 py-20">
      <p className="text-sm text-primary">404</p>
      <h1 className="text-3xl font-medium tracking-tight">
        Halaman tidak ditemukan.
      </h1>
      <p className="leading-7 text-muted-foreground">
        Alamat yang Anda buka mungkin sudah berubah.
      </p>
      <Button asChild className="h-11 self-start px-5">
        <Link href="/">Kembali ke beranda</Link>
      </Button>
    </main>
  );
}
