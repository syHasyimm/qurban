"use client";

import { useState, type ReactNode } from "react";
import { Download, MoreHorizontal, SlidersHorizontal, X } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function MobileActions({
  title,
  description,
  children,
  label = "Ekspor",
  icon = true,
  compact = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  label?: string;
  icon?: boolean;
  compact?: boolean;
}) {
  const mobile = useMobile();
  const [open, setOpen] = useState(false);
  if (!mobile) return <>{children}</>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" aria-label={compact ? title : undefined}>
          {compact ? (
            <MoreHorizontal size={18} />
          ) : (
            <>
              {icon && <Download size={16} />}
              {label}
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="qm-overlay qm-sheet" showCloseButton={false}>
        <DialogHeader className="qm-overlay-heading">
          <DialogTitle>{title}</DialogTitle>
          <button
            className="qm-icon-button"
            aria-label="Tutup pilihan"
            onClick={() => setOpen(false)}
          >
            <X size={21} />
          </button>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="qm-action-sheet">
          <p>{description}</p>
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MobileFilters({
  children,
  count = 0,
  onReset,
}: {
  children: ReactNode;
  count?: number;
  onReset?: () => void;
}) {
  const mobile = useMobile();
  const [open, setOpen] = useState(false);
  if (!mobile) return <div className="qm-filter-desktop">{children}</div>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="qm-filter-trigger">
          <SlidersHorizontal size={16} />
          Filter{count > 0 && <span>{count}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="qm-overlay qm-sheet" showCloseButton={false}>
        <DialogHeader className="qm-overlay-heading">
          <DialogTitle>Filter daftar</DialogTitle>
          <button
            className="qm-icon-button"
            aria-label="Tutup filter"
            onClick={() => setOpen(false)}
          >
            <X size={21} />
          </button>
          <DialogDescription className="sr-only">
            Pilih kriteria untuk mempersempit daftar. Pilihan langsung
            diterapkan.
          </DialogDescription>
        </DialogHeader>
        <div className="qm-filter-body">{children}</div>
        <div className="qm-cash-footer">
          <Button onClick={() => setOpen(false)}>Tampilkan hasil</Button>
          {onReset && (
            <Button variant="ghost" onClick={onReset}>
              Atur ulang
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
