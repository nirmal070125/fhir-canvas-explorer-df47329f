// Global test setup: jest-dom matchers + automatic cleanup between tests.
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  // The polyfill store below (and jsdom's own storage) is module-level, so
  // clear it here to keep state from leaking across tests and files.
  localStorage.clear();
});

// jsdom lacks several APIs that Radix UI / cmdk rely on (pointer capture,
// scrollIntoView, ResizeObserver). Polyfill them so popover/command components
// can be exercised in tests.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage === undefined) {
  // Some jsdom/happy-dom setups expose window without Storage; back it with a Map.
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  // Assign directly (not vi.stubGlobal) so tests calling vi.unstubAllGlobals() don't remove it.
  Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true });
}
if (typeof window !== "undefined" && !window.matchMedia) {
  // react18-json-view probes prefers-color-scheme on mount.
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as MediaQueryList;
}
if (!("ResizeObserver" in globalThis)) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}
