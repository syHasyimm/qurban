"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  async function logout() {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Belum dapat keluar. Silakan coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      className="h-10 gap-2 px-3 sm:px-4"
      disabled={pending}
      aria-label={pending ? "Sedang keluar" : "Keluar"}
      onClick={logout}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <LogOut aria-hidden="true" />
      )}
      <span>{pending ? "Keluar…" : "Keluar"}</span>
    </Button>
  );
}
