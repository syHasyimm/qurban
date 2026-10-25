"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { loginSchema, type LoginValues } from "@/lib/validations/auth";
import { loginErrorMessage } from "@/lib/login-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function LoginForm({ status }: { status?: string } = {}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [visible, setVisible] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setError(undefined);
    try {
      const result = await authClient.signIn.email(values);
      if (result.error) {
        setError(loginErrorMessage(result.error));
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung. Periksa koneksi Anda dan coba lagi.");
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-5"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  placeholder="nama@contoh.id"
                  className="h-11"
                  disabled={form.formState.isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kata sandi</FormLabel>
              <div className="qm-password">
                <FormControl>
                  <Input
                    {...field}
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    className="h-11"
                    disabled={form.formState.isSubmitting}
                  />
                </FormControl>
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={
                    visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                  }
                  aria-pressed={visible}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {status && !error && (
          <p className="qm-login-status" role="status">
            {status === "berakhir"
              ? "Sesi Anda berakhir. Masuk kembali untuk melanjutkan."
              : "Akses panitia tidak tersedia. Masuk dengan akun panitia aktif atau hubungi pengelola."}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-11 w-full"
        >
          {form.formState.isSubmitting && (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          )}
          {form.formState.isSubmitting ? "Sedang masuk…" : "Masuk ke akun"}
        </Button>
      </form>
    </Form>
  );
}
