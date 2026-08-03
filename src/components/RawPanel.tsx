import { useEffect, useState } from "react";
import { fhirFetch, type FhirResponse } from "@/lib/fhir-client";
import { useExplorerBus } from "@/lib/explorer-bus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { JsonEditor } from "./JsonEditor";
import { ResponseView } from "./ResponseView";
import { PanelSplit } from "./PanelSplit";

// Suggested names for the header rows — common FHIR/HTTP request headers.
const HEADER_SUGGESTIONS = [
  "Accept",
  "Authorization",
  "Cache-Control",
  "Content-Type",
  "If-Match",
  "If-Modified-Since",
  "If-None-Exist",
  "If-None-Match",
  "Prefer",
];

interface HeaderRow {
  k: string;
  v: string;
}

export function RawPanel({ baseUrl }: { baseUrl: string }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/metadata");
  const [body, setBody] = useState("");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([]);
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const bus = useExplorerBus();

  // Request-history entries replay here with method + path prefilled.
  useEffect(() => {
    if (bus?.tab !== "raw") return;
    const p = bus?.consumeRawPrefill();
    if (p) {
      setMethod(p.method);
      setPath(p.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus?.tab, bus?.rawPrefill]);

  function updateHeader(i: number, field: "k" | "v", value: string) {
    setHeaderRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function run() {
    setLoading(true);
    const hdrs: Record<string, string> = {};
    headerRows.forEach((r) => {
      if (r.k.trim()) hdrs[r.k.trim()] = r.v.trim();
    });
    try {
      setRes(
        await fhirFetch(
          path,
          {
            method,
            headers: hdrs,
            body: ["GET", "HEAD", "DELETE"].includes(method) ? undefined : body,
          },
          baseUrl,
        ),
      );
    } catch (e: any) {
      setRes({
        status: 0, ok: false, headers: {}, body: { error: e?.message }, raw: "",
        url: "", method, durationMs: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
        <div className="space-y-1.5">
          <Label>Method</Label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Path</Label>
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="/Patient?name=smith"
            className="font-mono text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Headers</Label>
        {headerRows.length > 0 && (
          <div className="space-y-2">
            {headerRows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label="Header name"
                  list="raw-header-names"
                  value={r.k}
                  onChange={(e) => updateHeader(i, "k", e.target.value)}
                  placeholder="Header"
                  className="w-2/5 font-mono text-sm"
                />
                <Input
                  aria-label="Header value"
                  value={r.v}
                  onChange={(e) => updateHeader(i, "v", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && run()}
                  placeholder="value"
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setHeaderRows((rows) => rows.filter((_, idx) => idx !== i))}
                  aria-label="Remove header"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <datalist id="raw-header-names">
          {HEADER_SUGGESTIONS.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHeaderRows((rows) => [...rows, { k: "", v: "" }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add header
        </Button>
      </div>

      {!["GET", "HEAD", "DELETE"].includes(method) && (
        <div className="space-y-1.5">
          <Label>Body</Label>
          <JsonEditor value={body} onChange={setBody} rows={10} ariaLabel="Request body" />
        </div>
      )}

      <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">
          <span className="mr-2 font-semibold text-primary">{method}</span>
          {path || "/"}
        </code>
        <Button onClick={run} disabled={loading} size="sm">
          {loading ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );

  return <PanelSplit form={form} response={<ResponseView res={res} />} />;
}
