import { expect, it } from "vitest";
import { createSidebarStore } from "@/stores/sidebar-store";

it("mengisolasi state sidebar antar-instance aplikasi", () => {
  const first = createSidebarStore();
  const second = createSidebarStore();
  first.getState().toggle();
  expect(first.getState().isOpen).toBe(false);
  expect(second.getState().isOpen).toBe(true);
});
