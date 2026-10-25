"use client";

import { useContext } from "react";
import { useStore } from "zustand";
import { SidebarContext } from "@/providers/sidebar-provider";
import type { SidebarState } from "@/stores/sidebar-store";

export function useSidebar<T>(selector: (state: SidebarState) => T) {
  const store = useContext(SidebarContext);
  if (!store)
    throw new Error("useSidebar must be used inside SidebarProvider.");
  return useStore(store, selector);
}
