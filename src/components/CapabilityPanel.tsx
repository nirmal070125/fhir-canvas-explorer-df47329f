import { useEffect, useMemo, useState } from "react";
import { fhirFetch, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponseView } from "./ResponseView";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const PAGE_SIZE = 10;

/** Page numbers to render: first, last, and a window around the current page. */
function pageNumbers(current: number, total: number): Array<number | "…"> {
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export function CapabilityPanel({ baseUrl }: { baseUrl: string }) {
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRes(await fhirFetch("/metadata", {}, baseUrl));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  const cs = res?.body as any;
  const resources: any[] = cs?.rest?.[0]?.resource ?? [];

  const filtered = useMemo(
    () =>
      filter.trim()
        ? resources.filter((r) =>
            String(r.type ?? "").toLowerCase().includes(filter.trim().toLowerCase()),
          )
        : resources,
    [resources, filter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {cs?.fhirVersion && (
            <>
              FHIR <Badge variant="secondary">{cs.fhirVersion}</Badge> ·{" "}
              {cs.software?.name} {cs.software?.version}
            </>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Reload"}
        </Button>
      </div>

      {resources.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filter resource types…"
              className="max-w-xs text-sm"
            />
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {resources.length} resource types
            </span>
          </div>
        <div className="overflow-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Resource</th>
                <th className="px-3 py-2">Interactions</th>
                <th className="px-3 py-2">Search Params</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.type} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{r.type}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(r.interaction ?? []).map((i: any) => (
                        <Badge key={i.code} variant="outline" className="text-[10px]">
                          {i.code}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      {(r.searchParam ?? []).length}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={safePage === 1}
                    className={safePage === 1 ? "pointer-events-none opacity-50" : ""}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                  />
                </PaginationItem>
                {pageNumbers(safePage, totalPages).map((p, i) => (
                  <PaginationItem key={`${p}-${i}`}>
                    {p === "…" ? (
                      <span className="px-2 text-sm text-muted-foreground">…</span>
                    ) : (
                      <PaginationLink
                        href="#"
                        isActive={p === safePage}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(p);
                        }}
                      >
                        {p}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={safePage === totalPages}
                    className={safePage === totalPages ? "pointer-events-none opacity-50" : ""}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      <ResponseView res={res} />
    </div>
  );
}
