import { useState } from "react";
import { fhirFetch, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponseView } from "./ResponseView";

export function RawPanel({ baseUrl }: { baseUrl: string }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/metadata");
  const [body, setBody] = useState("");
  const [headers, setHeaders] = useState("");
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const hdrs: Record<string, string> = {};
    headers
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l) => {
        const idx = l.indexOf(":");
        if (idx > 0) hdrs[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto]">
        <div>
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
        <div>
          <Label>Path</Label>
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={run} disabled={loading}>
            {loading ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>

      <div>
        <Label>Headers (one per line, Name: value)</Label>
        <Textarea
          value={headers}
          onChange={(e) => setHeaders(e.target.value)}
          rows={3}
          placeholder="If-Match: W/&quot;2&quot;"
          className="font-mono text-xs"
        />
      </div>

      {!["GET", "HEAD", "DELETE"].includes(method) && (
        <div>
          <Label>Body</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="font-mono text-xs"
          />
        </div>
      )}

      <ResponseView res={res} />
    </div>
  );
}
