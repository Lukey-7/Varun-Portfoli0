import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

// The cyan page prints a one-line greeting to the console when it first mounts.
// Keep it out of every file's output; the test that checks it reads the spy.
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

// Files that run in the node environment (pure logic, like the CV encryption) have no window.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
