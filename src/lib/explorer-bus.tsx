import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Cross-tab coordination: lets one panel open another tab with fields
 * prefilled (e.g. "Edit this resource" on a read result jumps to the
 * Create/Update tab, request-history entries replay in the Raw tab).
 * Each prefill is consumed exactly once by the target panel.
 */

export interface WritePrefill {
  op: "update" | "create" | "patch";
  type: string;
  id: string;
  body: string;
  ifMatch?: string;
}

export interface RawPrefill {
  method: string;
  path: string;
}

interface ExplorerBus {
  tab: string;
  setTab: (tab: string) => void;
  writePrefill: WritePrefill | null;
  openWrite: (prefill: WritePrefill) => void;
  consumeWritePrefill: () => WritePrefill | null;
  rawPrefill: RawPrefill | null;
  openRaw: (prefill: RawPrefill) => void;
  consumeRawPrefill: () => RawPrefill | null;
  openRead: (type: string, id: string) => void;
  readPrefill: { type: string; id: string } | null;
  consumeReadPrefill: () => { type: string; id: string } | null;
}

const Ctx = createContext<ExplorerBus | null>(null);

export function ExplorerBusProvider({
  tab,
  setTab,
  children,
}: {
  tab: string;
  setTab: (tab: string) => void;
  children: ReactNode;
}) {
  const [writePrefill, setWritePrefill] = useState<WritePrefill | null>(null);
  const [rawPrefill, setRawPrefill] = useState<RawPrefill | null>(null);
  const [readPrefill, setReadPrefill] = useState<{ type: string; id: string } | null>(null);

  const bus: ExplorerBus = {
    tab,
    setTab,
    writePrefill,
    openWrite: (p) => {
      setWritePrefill(p);
      setTab("write");
    },
    consumeWritePrefill: () => {
      const p = writePrefill;
      if (p) setWritePrefill(null);
      return p;
    },
    rawPrefill,
    openRaw: (p) => {
      setRawPrefill(p);
      setTab("raw");
    },
    consumeRawPrefill: () => {
      const p = rawPrefill;
      if (p) setRawPrefill(null);
      return p;
    },
    readPrefill,
    openRead: (type, id) => {
      setReadPrefill({ type, id });
      setTab("instance");
    },
    consumeReadPrefill: () => {
      const p = readPrefill;
      if (p) setReadPrefill(null);
      return p;
    },
  };

  return <Ctx.Provider value={bus}>{children}</Ctx.Provider>;
}

export function useExplorerBus(): ExplorerBus | null {
  return useContext(Ctx);
}
