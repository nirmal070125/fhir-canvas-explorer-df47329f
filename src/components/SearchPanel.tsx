import { useState } from "react";
import { fhirFetch, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponseView } from "./ResponseView";
import { ResourceCombobox } from "./ResourceCombobox";
import { SearchParamCombobox } from "./SearchParamCombobox";
import { useResourceSearchParams } from "@/hooks/use-resource-search-params";
import { valueHintForType } from "@/lib/fhir-search-params";
import { Plus, Trash2, Search } from "lucide-react";

export function SearchPanel({ baseUrl }: { baseUrl: string }) {
  const [resourceType, setResourceType] = useState("Patient");
  const [params, setParams] = useState<Array<{ k: string; v: string }>>([
    { k: "_count", v: "10" },
  ]);
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [usePost, setUsePost] = useState(false);
  const { byName } = useResourceSearchParams(resourceType, baseUrl);

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
    const qs = params
      .filter((p) => p.k.trim())
      .map((p) => `${encodeURIComponent(p.k)}=${encodeURIComponent(p.v)}`)
      .join("&");
    try {
      if (usePost) {
        setRes(
          await fhirFetch(
            `/${resourceType}/_search`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: qs,
            },
            baseUrl,
          ),
        );
      } else {
        setRes(await fhirFetch(`/${resourceType}${qs ? `?${qs}` : ""}`, {}, baseUrl));
      }
    } catch (e: any) {
      setRes({
        status: 0,
        ok: false,
        headers: {},
        body: { error: e?.message || "Network error" },
        raw: "",
        url: "",
        method: usePost ? "POST" : "GET",
        durationMs: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  async function followLink(url: string) {
    setLoading(true);
    try {
      setRes(await fhirFetch(url, {}, baseUrl));
    } finally {
      setLoading(false);
    }
  }

  const bundle = res?.body as any;
  const links: Array<{ relation: string; url: string }> = bundle?.link ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
        <div>
          <Label htmlFor="rt">Resource Type</Label>
          <ResourceCombobox
            id="rt"
            value={resourceType}
            onChange={setResourceType}
            baseUrl={baseUrl}
          />
        </div>
        <div>
          <Label>Method</Label>
          <div className="flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={!usePost}
                onChange={() => setUsePost(false)}
              />
              GET
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={usePost}
                onChange={() => setUsePost(true)}
              />
              POST /_search
            </label>
          </div>
        </div>
        <div className="flex items-end">
          <Button onClick={run} disabled={loading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Search Parameters</Label>
        {params.map((p, i) => {
          const def = byName.get(p.k);
          return (
            <div key={i} className="flex gap-2">
              <div className="flex-1">
                <SearchParamCombobox
                  resourceType={resourceType}
                  baseUrl={baseUrl}
                  value={p.k}
                  onChange={(name) => update(i, "k", name)}
                />
              </div>
              <Input
                aria-label="Parameter value"
                placeholder={valueHintForType(def?.type)}
                value={p.v}
                onChange={(e) => update(i, "v", e.target.value)}
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

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <Button
              key={l.relation + l.url}
              variant="secondary"
              size="sm"
              onClick={() => followLink(l.url)}
            >
              {l.relation} →
            </Button>
          ))}
        </div>
      )}

      {bundle?.resourceType === "Bundle" && Array.isArray(bundle.entry) && (
        <div className="rounded-md border bg-card">
          <div className="border-b px-3 py-2 text-sm">
            <span className="font-medium">{bundle.entry.length}</span>{" "}
            <span className="text-muted-foreground">entries</span>
            {typeof bundle.total === "number" && (
              <span className="text-muted-foreground"> · total {bundle.total}</span>
            )}
          </div>
          <ul className="divide-y">
            {bundle.entry.slice(0, 50).map((e: any, i: number) => {
              const r = e.resource ?? {};
              return (
                <li key={i} className="px-3 py-2 text-sm">
                  <code className="font-mono text-xs text-primary">
                    {r.resourceType}/{r.id}
                  </code>
                  {r.meta?.versionId && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      v{r.meta.versionId}
                    </span>
                  )}
                  <div className="truncate text-xs text-muted-foreground">
                    {summarize(r)}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ResponseView res={res} />
    </div>
  );
}

function summarize(r: any): string {
  if (!r) return "";
  if (r.name?.[0]) {
    const n = r.name[0];
    return [n.given?.join(" "), n.family].filter(Boolean).join(" ");
  }
  if (r.code?.text) return r.code.text;
  if (r.description) return r.description;
  if (r.status) return `status: ${r.status}`;
  return "";
}
