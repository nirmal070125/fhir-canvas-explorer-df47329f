import { useMemo, useState } from "react";
import type { FhirResponse } from "@/lib/fhir-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getOperationOutcome,
  issueText,
  responseFileName,
  type OperationOutcomeIssue,
} from "@/lib/fhir-response";

export function ResponseView({ res }: { res: FhirResponse | null }) {
  const [copied, setCopied] = useState(false);

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

  const outcome = getOperationOutcome(res.body);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pretty);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  function download() {
    const blob = new Blob([pretty], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = responseFileName(res!);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge className={statusColor}>
          {res.method} {res.status}
        </Badge>
        <span className="text-muted-foreground">{res.durationMs}ms</span>
        <code className="max-w-full truncate rounded bg-muted px-2 py-0.5 font-mono text-xs">
          {res.url}
        </code>
        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={copy}
            aria-label="Copy response JSON"
            disabled={!pretty}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={download}
            aria-label="Download response JSON"
            disabled={!pretty}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      {outcome && <OperationOutcomeView issues={outcome.issue ?? []} />}

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

const SEVERITY_STYLES: Record<string, string> = {
  fatal: "bg-destructive text-destructive-foreground",
  error: "bg-destructive text-destructive-foreground",
  warning: "bg-amber-500 text-white",
  information: "bg-muted text-foreground",
};

function OperationOutcomeView({ issues }: { issues: OperationOutcomeIssue[] }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5">
      <div className="border-b border-destructive/30 px-3 py-2 text-sm font-medium">
        OperationOutcome · {issues.length} issue{issues.length === 1 ? "" : "s"}
      </div>
      <ul className="divide-y divide-border">
        {issues.map((issue, i) => (
          <li key={i} className="px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("text-[10px]", SEVERITY_STYLES[issue.severity ?? ""] ?? "bg-muted text-foreground")}>
                {issue.severity ?? "issue"}
              </Badge>
              {issue.code && <span className="font-mono text-xs text-muted-foreground">{issue.code}</span>}
            </div>
            {issueText(issue) && <p className="mt-1 text-sm text-foreground">{issueText(issue)}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
