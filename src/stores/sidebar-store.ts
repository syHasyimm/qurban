import { createStore } from "zustand/vanilla";

export type SidebarState = {
  isOpen: boolean;
  toggle: () => void;
};

// A factory keeps each rendered application/request isolated.
export function createSidebarStore() {
  return createStore<SidebarState>()((set) => ({
    isOpen: true,
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  }));
}
