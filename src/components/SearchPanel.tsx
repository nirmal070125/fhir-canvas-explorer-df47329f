import { useState } from "react";
import { fhirFetch, encodeFhirPathSegment, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponseView } from "./ResponseView";
import { ResourceCombobox } from "./ResourceCombobox";
import { PanelSplit } from "./PanelSplit";
import { SearchParamCombobox } from "./SearchParamCombobox";
import { CopyButton } from "./CopyButton";
import { useResourceSearchParams } from "@/hooks/use-resource-search-params";
import { valueHintForType } from "@/lib/fhir-search-params";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Search, ChevronDown } from "lucide-react";

export function SearchPanel({ baseUrl }: { baseUrl: string }) {
  const [resourceType, setResourceType] = useState("Patient");
  const [params, setParams] = useState<Array<{ k: string; v: string }>>([
    { k: "_count", v: "10" },
  ]);
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [usePost, setUsePost] = useState(false);
  const [sortParam, setSortParam] = useState("");
  const [sortDesc, setSortDesc] = useState(false);
  const [summary, setSummary] = useState("");
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());
  const { byName } = useResourceSearchParams(resourceType, baseUrl);

  function toggleRow(i: number) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function update(i: number, field: "k" | "v", v: string) {
    setParams((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)));
  }
  function add() {
    setParams((p) => [...p, { k: "", v: "" }]);
  }
  function remove(i: number) {
    setParams((p) => p.filter((_, idx) => idx !== i));
  }

  function buildQuery(): string {
    const parts = params
      .filter((p) => p.k.trim())
      .map((p) => `${encodeURIComponent(p.k)}=${encodeURIComponent(p.v)}`);
    if (sortParam.trim())
      parts.push(`_sort=${encodeURIComponent((sortDesc ? "-" : "") + sortParam.trim())}`);
    if (summary) parts.push(`_summary=${encodeURIComponent(summary)}`);
    return parts.join("&");
  }

  async function run() {
    setLoading(true);
    setOpenRows(new Set());
    const qs = buildQuery();
    const rt = encodeFhirPathSegment(resourceType);
    try {
      if (usePost) {
        setRes(
          await fhirFetch(
            `/${rt}/_search`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: qs,
            },
            baseUrl,
          ),
        );
      } else {
        setRes(await fhirFetch(`/${rt}${qs ? `?${qs}` : ""}`, {}, baseUrl));
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

  const form = (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rt">Resource Type</Label>
          <ResourceCombobox
            id="rt"
            value={resourceType}
            onChange={setResourceType}
            baseUrl={baseUrl}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Method</Label>
          <div className="flex h-9 items-center gap-3 rounded-md border bg-card px-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="search-method"
                checked={!usePost}
                onChange={() => setUsePost(false)}
              />
              GET
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="search-method"
                checked={usePost}
                onChange={() => setUsePost(true)}
              />
              POST /_search
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Search Parameters</Label>
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="mr-1 h-4 w-4" /> Add parameter
          </Button>
        </div>
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
                onKeyDown={(e) => e.key === "Enter" && run()}
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
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_160px]">
        <div className="space-y-1.5">
          <Label htmlFor="sort-param">Sort by</Label>
          <Input
            id="sort-param"
            value={sortParam}
            onChange={(e) => setSortParam(e.target.value)}
            placeholder="_lastUpdated, name, date…"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Direction</Label>
          <div className="flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="sort-dir"
                checked={!sortDesc}
                onChange={() => setSortDesc(false)}
              />
              Asc
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="sort-dir"
                checked={sortDesc}
                onChange={() => setSortDesc(true)}
              />
              Desc
            </label>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="summary-mode">_summary</Label>
          <select
            id="summary-mode"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">(none)</option>
            <option value="true">true</option>
            <option value="text">text</option>
            <option value="data">data</option>
            <option value="count">count</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">
          <span className="mr-2 font-semibold text-primary">
            {usePost ? "POST" : "GET"}
          </span>
          {usePost
            ? `/${resourceType}/_search`
            : `/${resourceType}${buildQuery() ? `?${buildQuery()}` : ""}`}
        </code>
        <Button onClick={run} disabled={loading} size="sm">
          <Search className="mr-1 h-4 w-4" />
          {loading ? "Searching…" : "Search"}
        </Button>
      </div>
    </div>
  );

  const response = (
    <div className="space-y-4">
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
              const expanded = openRows.has(i);
              return (
                <li key={i} className="text-sm">
                  <div className="flex items-start gap-1 pr-2 hover:bg-muted/50">
                    <button
                      type="button"
                      onClick={() => toggleRow(i)}
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 items-start justify-between gap-2 px-3 py-2 text-left"
                    >
                      <span className="min-w-0">
                        <code className="font-mono text-xs text-primary">
                          {r.resourceType}/{r.id}
                        </code>
                        {r.meta?.versionId && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            v{r.meta.versionId}
                          </span>
                        )}
                        <span className="block truncate text-xs text-muted-foreground">
                          {summarize(r)}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </button>
                    {r.id && (
                      <CopyButton value={r.id} ariaLabel={`Copy id ${r.id}`} className="mt-1.5" />
                    )}
                  </div>
                  {expanded && (
                    <pre className="max-h-80 overflow-auto border-t bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed">
                      {JSON.stringify(r, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
          {bundle.entry.length > 50 && (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing first 50 of {bundle.entry.length} entries on this page. Use the paging links
              above to see more.
            </div>
          )}
        </div>
      )}

      <ResponseView res={res} />
    </div>
  );

  return <PanelSplit form={form} response={response} />;
}

function summarize(r: any): string {
  if (!r) return "";
  // HumanName (Patient, Practitioner, RelatedPerson, …)
  if (Array.isArray(r.name) && r.name[0]) {
    const n = r.name[0];
    const assembled = [n.prefix?.join(" "), n.given?.join(" "), n.family].filter(Boolean).join(" ");
    if (assembled || n.text) return assembled || n.text;
  }
  if (typeof r.name === "string") return r.name;
  // Coded concepts (Observation, Condition, Procedure, …)
  const code = r.code ?? r.medicationCodeableConcept ?? r.vaccineCode;
  if (code?.text) return code.text;
  if (code?.coding?.[0]) return code.coding[0].display || code.coding[0].code || "";
  if (r.title) return r.title;
  if (r.description) return r.description;
  // Fall back to a few status-ish fields
  const bits: string[] = [];
  if (r.status) bits.push(r.status);
  if (r.class?.code) bits.push(r.class.code);
  if (r.period?.start) bits.push(r.period.start);
  if (typeof r.value === "string") bits.push(r.value);
  return bits.join(" · ");
}
