import { useMemo } from "react";
import type { FhirResponse } from "@/lib/fhir-client";
import { Badge } from "@/components/ui/badge";

export function ResponseView({ res }: { res: FhirResponse | null }) {
  const pretty = useMemo(() => {
    if (!res) return "";
    if (typeof res.body === "string") return res.body;
    try {
      return JSON.stringify(res.body, null, 2);
    } catch {
      return res.raw;
    }
  }, [res]);

  if (!res) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Response will appear here.
      </div>
    );
  }

  const statusColor =
    res.status >= 200 && res.status < 300
      ? "bg-primary text-primary-foreground"
      : res.status >= 400
        ? "bg-destructive text-destructive-foreground"
        : "bg-muted text-foreground";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge className={statusColor}>
          {res.method} {res.status}
        </Badge>
        <span className="text-muted-foreground">{res.durationMs}ms</span>
        <code className="truncate rounded bg-muted px-2 py-0.5 font-mono text-xs">{res.url}</code>
      </div>
      {Object.keys(res.headers).length > 0 && (
        <details className="rounded-md border bg-card">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
            Headers ({Object.keys(res.headers).length})
          </summary>
          <pre className="overflow-auto border-t px-3 py-2 font-mono text-xs">
            {Object.entries(res.headers)
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n")}
          </pre>
        </details>
      )}
      <pre className="max-h-[600px] overflow-auto rounded-md border bg-card p-3 font-mono text-xs leading-relaxed">
        {pretty}
      </pre>
    </div>
  );
}
