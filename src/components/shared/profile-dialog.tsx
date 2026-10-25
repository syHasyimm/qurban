"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateProfile } from "@/app/(app)/dashboard/actions";
import { profileSchema, type ProfileValues } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function ProfileDialog({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name },
  });

  async function onSubmit(values: ProfileValues) {
    setError(undefined);
    try {
      const result = await updateProfile(values);
      if (result.error) {
        setError(result.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      router.refresh();
      setOpen(false);
      toast.success("Nama Anda berhasil diperbarui.");
    } catch {
      setError("Tidak dapat terhubung. Silakan coba lagi.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          form.reset({ name });
          setError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 px-4">
          Ubah profil
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah profil</DialogTitle>
          <DialogDescription>
            Perbarui nama yang ditampilkan di akun Anda.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama lengkap</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="name"
                      className="h-11"
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-11 w-full"
            >
              {form.formState.isSubmitting ? "Menyimpan…" : "Simpan perubahan"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
