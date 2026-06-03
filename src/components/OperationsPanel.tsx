import { useEffect, useMemo, useState } from "react";
import { fhirFetch, encodeFhirPathSegment, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponseView } from "./ResponseView";
import { ResourceCombobox } from "./ResourceCombobox";
import { OperationCombobox } from "./OperationCombobox";
import { OperationParamCombobox } from "./OperationParamCombobox";
import { Plus, Trash2, Play } from "lucide-react";
import { useOperations } from "@/hooks/use-operations";
import {
  buildOperationQuery,
  buildParametersResource,
  CURATED_BY_NAME,
  mustUsePost,
  operationValueHint,
  type OperationScope,
} from "@/lib/fhir-operations";

const SCOPES: { value: OperationScope; label: string }[] = [
  { value: "system", label: "System" },
  { value: "type", label: "Type" },
  { value: "instance", label: "Instance" },
];

export function OperationsPanel({ baseUrl }: { baseUrl: string }) {
  const [scope, setScope] = useState<OperationScope>("instance");
  const [resourceType, setResourceType] = useState("Patient");
  const [id, setId] = useState("");
  const [opName, setOpName] = useState("everything");
  // Parameter rows (name + value), mirroring the Search panel's UX.
  const [params, setParams] = useState<Array<{ k: string; v: string }>>([{ k: "", v: "" }]);
  const [methodOverride, setMethodOverride] = useState<"GET" | "POST" | null>(null);
  const [editBody, setEditBody] = useState(false);
  const [rawBody, setRawBody] = useState("");
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const { byName } = useOperations(scope, resourceType, baseUrl);
  const op = byName.get(opName);
  const inParams = useMemo(() => (op?.parameters ?? []).filter((p) => p.use === "in"), [op]);
  const byParamName = useMemo(() => new Map(inParams.map((p) => [p.name, p])), [inParams]);

  // Reset the form whenever the operation context changes, so stale values from
  // a previous operation never leak into the next request. Seed rows with the
  // operation's required inputs; otherwise start with one empty row.
  useEffect(() => {
    const required = (CURATED_BY_NAME.get(opName)?.parameters ?? [])
      .filter((p) => p.use === "in" && p.min)
      .map((p) => ({ k: p.name, v: "" }));
    setParams(required.length ? required : [{ k: "", v: "" }]);
    setMethodOverride(null);
    setEditBody(false);
    setRawBody("");
  }, [opName, scope, resourceType]);

  // Filled rows, typed from the operation's parameter definitions where known.
  const filled = useMemo(
    () =>
      params
        .filter((p) => p.k.trim() && p.v.trim())
        .map((p) => ({ name: p.k.trim(), value: p.v, type: byParamName.get(p.k)?.type })),
    [params, byParamName],
  );

  const defaultPost = mustUsePost(op, filled);
  const method = methodOverride ?? (defaultPost ? "POST" : "GET");
  const forcedPost = mustUsePost(op, filled) && method === "GET";

  const path = useMemo(() => {
    const seg = `$${encodeFhirPathSegment(opName)}`;
    if (scope === "system") return `/${seg}`;
    const t = encodeFhirPathSegment(resourceType);
    if (scope === "type") return `/${t}/${seg}`;
    return `/${t}/${encodeFhirPathSegment(id)}/${seg}`;
  }, [scope, resourceType, id, opName]);

  const generatedBody = useMemo(
    () => JSON.stringify(buildParametersResource(filled), null, 2),
    [filled],
  );
  const query = useMemo(
    () => buildOperationQuery(filled.map((r) => ({ name: r.name, value: r.value }))),
    [filled],
  );

  const requestPath = method === "GET" && query ? `${path}?${query}` : path;
  const body = editBody ? rawBody : generatedBody;
  const needsId = scope === "instance" && !id.trim();
  const canRun = !!opName.trim() && !needsId && !loading;

  function update(i: number, field: "k" | "v", v: string) {
    setParams((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)));
  }
  function add() {
    setParams((p) => [...p, { k: "", v: "" }]);
  }
  function remove(i: number) {
    setParams((p) => p.filter((_, idx) => idx !== i));
  }

  async function run() {
    setLoading(true);
    try {
      const init =
        method === "POST"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/fhir+json" },
              body,
            }
          : {};
      setRes(await fhirFetch(requestPath, init, baseUrl));
    } catch (e: unknown) {
      setRes({
        status: 0,
        ok: false,
        headers: {},
        body: { error: e instanceof Error ? e.message : "Network error" },
        raw: "",
        url: "",
        method,
        durationMs: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Scope */}
      <div className="flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <Button
            key={s.value}
            size="sm"
            variant={scope === s.value ? "default" : "outline"}
            onClick={() => setScope(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* Target: resource type / id (for type & instance scope) + operation */}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        {scope !== "system" && (
          <div>
            <Label htmlFor="op-type">Resource Type</Label>
            <ResourceCombobox
              id="op-type"
              value={resourceType}
              onChange={setResourceType}
              baseUrl={baseUrl}
            />
          </div>
        )}
        {scope === "instance" && (
          <div>
            <Label>ID</Label>
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="resource id"
              className="font-mono text-sm"
            />
          </div>
        )}
        <div>
          <Label>Operation</Label>
          <OperationCombobox
            scope={scope}
            resourceType={resourceType}
            baseUrl={baseUrl}
            value={opName}
            onChange={setOpName}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={run} disabled={!canRun} className="w-full">
            <Play className="mr-2 h-4 w-4" />
            {loading ? "Running…" : "Invoke"}
          </Button>
        </div>
      </div>

      {op?.documentation && <p className="text-xs text-muted-foreground">{op.documentation}</p>}

      {/* Invocation method */}
      <div className="flex flex-wrap items-center gap-3">
        <Label className="m-0">Invoke as</Label>
        <div className="flex h-9 items-center gap-3 rounded-md border bg-card px-3 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="op-method"
              checked={method === "GET"}
              onChange={() => setMethodOverride("GET")}
            />
            GET
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="op-method"
              checked={method === "POST"}
              onChange={() => setMethodOverride("POST")}
            />
            POST
          </label>
        </div>
        {forcedPost && (
          <span className="text-xs text-destructive">
            This operation needs POST (changes state or has a complex parameter).
          </span>
        )}
      </div>

      {/* Parameters — same combobox-row UX as the Search panel */}
      <div className="space-y-2">
        <Label>Parameters</Label>
        {params.map((p, i) => {
          const def = byParamName.get(p.k);
          return (
            <div key={i} className="flex gap-2">
              <div className="flex-1">
                <OperationParamCombobox
                  params={inParams}
                  value={p.k}
                  onChange={(name) => update(i, "k", name)}
                />
              </div>
              <Input
                aria-label="Parameter value"
                placeholder={operationValueHint(def?.type)}
                value={p.v}
                onChange={(e) => update(i, "v", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canRun && run()}
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                aria-label="Remove parameter"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Add parameter
        </Button>
      </div>

      {/* Request preview */}
      <div className="rounded-md border bg-muted/30">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Request preview</span>
          {method === "POST" && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={editBody}
                onChange={(e) => setEditBody(e.target.checked)}
              />
              Edit body
            </label>
          )}
        </div>
        <pre className="overflow-auto px-3 py-2 font-mono text-xs">
          {method} {requestPath}
        </pre>
        {method === "POST" &&
          (editBody ? (
            <Textarea
              aria-label="Request body"
              value={rawBody || generatedBody}
              onChange={(e) => setRawBody(e.target.value)}
              rows={10}
              className="rounded-none border-0 border-t font-mono text-xs"
            />
          ) : (
            <pre className="max-h-64 overflow-auto border-t px-3 py-2 font-mono text-xs">
              {generatedBody}
            </pre>
          ))}
      </div>

      <ResponseView res={res} />
    </div>
  );
}
