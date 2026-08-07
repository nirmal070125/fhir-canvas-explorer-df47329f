/** Rolling localStorage log of recent requests; fhirFetch records them, the header menu lists and replays them via the Raw tab. */

export interface HistoryEntry {
  method: string;
  /** Path as passed to fhirFetch (relative to base) or an absolute URL. */
  path: string;
  status: number;
  ts: number;
}

const STORAGE_KEY = "fhir-explorer:request-history";
const MAX_ENTRIES = 25;
const CHANGE_EVENT = "fhir-explorer:history-change";

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isSameRequest(
  a: Pick<HistoryEntry, "method" | "path">,
  b: Pick<HistoryEntry, "method" | "path">,
) {
  return a.method === b.method && a.path === b.path;
}

function saveHistory(list: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage full/unavailable — history is best-effort */
  }
}

export function recordRequest(entry: Omit<HistoryEntry, "ts">) {
  if (typeof window === "undefined") return;

  const history = getHistory();
  const latest = history[0];
  // Collapse consecutive repeats so paging through a search doesn't fill the whole list.
  if (latest && isSameRequest(latest, entry)) history.shift();

  const updated = [{ ...entry, ts: Date.now() }, ...history].slice(0, MAX_ENTRIES);
  saveHistory(updated);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onHistoryChange(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}
