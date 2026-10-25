"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 px-6 py-20">
      <h1 className="text-3xl font-medium tracking-tight">
        Ada kendala sementara.
      </h1>
      <p className="leading-7 text-muted-foreground">
        Halaman belum dapat dimuat. Silakan coba lagi dalam beberapa saat.
      </p>
      <Button onClick={reset} className="h-11 self-start px-5">
        Coba lagi
      </Button>
    </main>
  );
}
