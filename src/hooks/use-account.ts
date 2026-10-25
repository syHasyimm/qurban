"use client";

import { useQuery } from "@tanstack/react-query";
import type { AccountSummary } from "@/lib/types";

export function useAccount(initialData: AccountSummary) {
  return useQuery({
    queryKey: ["account"],
    initialData,
    queryFn: async ({ signal }): Promise<AccountSummary> => {
      const response = await fetch("/api/account", {
        signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Sesi berakhir. Silakan masuk kembali."
            : "Informasi akun belum dapat dimuat. Silakan coba lagi.",
        );
      }
      return response.json();
    },
  });
}
