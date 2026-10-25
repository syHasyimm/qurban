"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import type { AccountSummary } from "@/lib/types";
import { ProfileDialog } from "@/components/shared/profile-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function AccountCard({
  initialAccount,
}: {
  initialAccount: AccountSummary;
}) {
  const {
    data: account,
    error,
    isFetching,
    refetch,
  } = useAccount(initialAccount);
  return (
    <Card className="rounded-2xl py-7 [--card-spacing:--spacing(7)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Informasi akun</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Detail akun pribadi Anda.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Perbarui informasi akun"
          >
            <RefreshCw
              className={isFetching ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error.message}{" "}
            <Link href="/login" className="underline">
              Masuk kembali
            </Link>
          </div>
        )}
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {[
            { label: "Nama lengkap", value: account.name },
            { label: "Email", value: account.email },
            { label: "Bergabung sejak", value: formatDate(account.createdAt) },
            {
              label: "Sesi berlaku hingga",
              value: formatDate(account.sessionExpiresAt),
            },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-2 text-sm font-medium break-words">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 border-t border-border pt-6">
          <ProfileDialog name={account.name} />
        </div>
      </CardContent>
    </Card>
  );
}
