"use client";

import { createContext, useState } from "react";
import { createSidebarStore } from "@/stores/sidebar-store";

export const SidebarContext = createContext<ReturnType<
  typeof createSidebarStore
> | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(createSidebarStore);
  return (
    <SidebarContext.Provider value={store}>{children}</SidebarContext.Provider>
  );
}
