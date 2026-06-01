import { useEffect, useMemo, useState } from "react";
import { fhirFetch, encodeFhirPathSegment, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ResponseView } from "./ResponseView";
import { ResourceCombobox } from "./ResourceCombobox";
import { OperationCombobox } from "./OperationCombobox";
import { Plus, Trash2, Play } from "lucide-react";
import { useOperations } from "@/hooks/use-operations";
import {
  buildOperationQuery,
  buildParametersResource,
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
  // Values for the operation's documented input parameters, keyed by name.
  const [values, setValues] = useState<Record<string, string>>({});
  // Extra/undocumented parameters as free-form rows.
  const [custom, setCustom] = useState<Array<{ k: string; v: string }>>([]);
  const [methodOverride, setMethodOverride] = useState<"GET" | "POST" | null>(null);
  const [editBody, setEditBody] = useState(false);
  const [rawBody, setRawBody] = useState("");
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const { byName } = useOperations(scope, resourceType, baseUrl);
  const op = byName.get(opName);
  const inParams = useMemo(() => (op?.parameters ?? []).filter((p) => p.use === "in"), [op]);

  // Reset the form whenever the operation context changes, so stale values from
  // a previous operation never leak into the next request.
  useEffect(() => {
    setValues({});
    setCustom([]);
    setMethodOverride(null);
    setEditBody(false);
    setRawBody("");
  }, [opName, scope, resourceType]);

  // All filled rows (documented + custom), with their declared types.
  const filled = useMemo(() => {
    const known = inParams
      .map((p) => ({ name: p.name, value: values[p.name] ?? "", type: p.type }))
      .filter((r) => r.value.trim());
    const extra = custom
      .filter((r) => r.k.trim())
      .map((r) => ({ name: r.k.trim(), value: r.v, type: undefined as string | undefined }));
    return [...known, ...extra];
  }, [inParams, values, custom]);

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

  function setValue(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
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

      {/* Documented input parameters */}
      {inParams.length > 0 && (
        <div className="space-y-2">
          <Label>Parameters</Label>
          {inParams.map((p) => (
            <div key={p.name} className="flex items-start gap-2">
              <div className="w-48 shrink-0 pt-2">
                <div className="flex items-center gap-1.5">
                  <code className="font-mono text-xs text-primary">{p.name}</code>
                  {p.type && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {p.type}
                    </Badge>
                  )}
                  {p.min ? <span className="text-[10px] text-destructive">required</span> : null}
                </div>
                {p.documentation && (
                  <span className="line-clamp-2 text-[11px] text-muted-foreground">
                    {p.documentation}
                  </span>
                )}
              </div>
              <Input
                aria-label={`Value for ${p.name}`}
                placeholder={operationValueHint(p.type)}
                value={values[p.name] ?? ""}
                onChange={(e) => setValue(p.name, e.target.value)}
                className="flex-1 font-mono text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {/* Custom parameters */}
      <div className="space-y-2">
        <Label>{inParams.length > 0 ? "Custom parameters" : "Parameters"}</Label>
        {custom.map((row, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label="Custom parameter name"
              placeholder="name"
              value={row.k}
              onChange={(e) =>
                setCustom((c) => c.map((r, idx) => (idx === i ? { ...r, k: e.target.value } : r)))
              }
              className="flex-1 font-mono text-sm"
            />
            <Input
              aria-label="Custom parameter value"
              placeholder="value"
              value={row.v}
              onChange={(e) =>
                setCustom((c) => c.map((r, idx) => (idx === i ? { ...r, v: e.target.value } : r)))
              }
              className="flex-1 font-mono text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove parameter"
              onClick={() => setCustom((c) => c.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCustom((c) => [...c, { k: "", v: "" }])}
        >
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
