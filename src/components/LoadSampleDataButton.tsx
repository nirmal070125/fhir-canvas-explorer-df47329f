import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { loadManifest, loadSampleData, type LoadProgress, type LoadSummary } from "@/lib/sample-data";

interface Props {
  baseUrl: string;
}

type State =
  | { kind: "idle" }
  | { kind: "loading"; progress: LoadProgress }
  | { kind: "done"; summary: LoadSummary }
  | { kind: "error"; message: string };

export function LoadSampleDataButton({ baseUrl }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  // Read the patient count from the manifest so the label never goes stale
  // when the dataset is resized.
  const [patientCount, setPatientCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadManifest().then(
      (m) => !cancelled && setPatientCount(m.patientCount ?? null),
      () => {
        /* manifest unavailable — fall back to a generic label */
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function run() {
    setState({
      kind: "loading",
      progress: { index: 0, total: 0, file: "", status: "loading" },
    });
    try {
      const summary = await loadSampleData(baseUrl, (progress) =>
        setState({ kind: "loading", progress }),
      );
      setState({ kind: "done", summary });
    } catch (e: unknown) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  const busy = state.kind === "loading";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={run} disabled={busy} variant="outline" size="sm" title={`POST sample bundles to ${baseUrl}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
        Load sample data
      </Button>
      <StatusLine state={state} patientCount={patientCount} />
    </div>
  );
}

function StatusLine({ state, patientCount }: { state: State; patientCount: number | null }) {
  if (state.kind === "idle") {
    return (
      <span className="text-xs text-muted-foreground">
        {patientCount != null
          ? `Seeds ${patientCount} synthetic patients (Synthea) into the server above.`
          : "Seeds synthetic patient data (Synthea) into the server above."}
      </span>
    );
  }

  if (state.kind === "loading") {
    const { index, total, file, status } = state.progress;
    if (total === 0) {
      return <span className="text-xs text-muted-foreground">Reading manifest…</span>;
    }
    return (
      <span className="text-xs text-muted-foreground">
        {status === "loading" ? "Posting" : "Posted"} {index + 1}/{total} —{" "}
        <span className="font-mono">{file}</span>
      </span>
    );
  }

  if (state.kind === "done") {
    const { ok, failed, resources, durationMs } = state.summary;
    const Icon = failed > 0 ? AlertCircle : CheckCircle2;
    const color = failed > 0 ? "text-destructive" : "text-primary";
    return (
      <span className={`flex items-center gap-1 text-xs ${color}`}>
        <Icon className="h-4 w-4" />
        Loaded {ok}/{ok + failed} bundles · {resources} resources · {durationMs}ms
        {failed > 0 && (
          <span className="ml-2 text-muted-foreground">
            ({state.summary.errors[0].message.slice(0, 80)}…)
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="h-4 w-4" />
      {state.message}
    </span>
  );
}
