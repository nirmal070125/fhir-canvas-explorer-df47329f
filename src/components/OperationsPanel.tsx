import { useEffect, useMemo, useState } from "react";
import { fhirFetch, encodeFhirPathSegment, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JsonEditor } from "./JsonEditor";
import { ResponseView } from "./ResponseView";
import { PanelSplit } from "./PanelSplit";
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

const SCOPES: { value: OperationScope; label: string; desc: string }[] = [
  { value: "system", label: "System", desc: "Server-wide, e.g. $convert" },
  { value: "type", label: "Type", desc: "On a resource type, e.g. $validate" },
  { value: "instance", label: "Instance", desc: "On one resource, e.g. $everything" },
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

  const form = (
    <div className="space-y-5">
      {/* Scope */}
      <div className="space-y-1.5">
        <Label>Scope</Label>
        <div className="grid grid-cols-3 gap-2">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setScope(s.value)}
              aria-pressed={scope === s.value}
              className={
                "rounded-md border px-3 py-2 text-left transition-colors " +
                (scope === s.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "bg-card hover:bg-muted/50")
              }
            >
              <span className="block text-sm font-medium">{s.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {s.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Target: resource type / id (for type & instance scope) + operation */}
      <div className="grid gap-3 sm:grid-cols-2">
        {scope !== "system" && (
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label>ID</Label>
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="resource id"
              className="font-mono text-sm"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Operation</Label>
          <OperationCombobox
            scope={scope}
            resourceType={resourceType}
            baseUrl={baseUrl}
            value={opName}
            onChange={setOpName}
          />
        </div>
      </div>

      {op?.documentation && <p className="text-xs text-muted-foreground">{op.documentation}</p>}

      {/* Invocation method */}
      <div className="space-y-1.5">
        <Label>Invoke as</Label>
        <div className="flex h-9 w-fit items-center gap-3 rounded-md border bg-card px-3 text-sm">
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

      {/* Request preview + invoke */}
      <div className="rounded-md border bg-muted/30">
        <div className="flex items-center gap-3 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            <span className="mr-2 font-semibold text-primary">{method}</span>
            {requestPath}
          </code>
          {method === "POST" && (
            <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={editBody}
                onChange={(e) => setEditBody(e.target.checked)}
              />
              Edit body
            </label>
          )}
          <Button onClick={run} disabled={!canRun} size="sm" className="shrink-0">
            <Play className="mr-1 h-4 w-4" />
            {loading ? "Running…" : "Invoke"}
          </Button>
        </div>
        {method === "POST" &&
          (editBody ? (
            <div className="border-t p-1">
              <JsonEditor
                ariaLabel="Request body"
                value={rawBody || generatedBody}
                onChange={setRawBody}
                rows={10}
                className="border-0"
              />
            </div>
          ) : (
            <pre className="max-h-64 overflow-auto border-t px-3 py-2 font-mono text-xs">
              {generatedBody}
            </pre>
          ))}
      </div>
    </div>
  );

  return <PanelSplit form={form} response={<ResponseView res={res} />} />;
}
