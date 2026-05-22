import { useEffect, useState } from "react";
import { fhirFetch, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { ResponseView } from "./ResponseView";
import { Badge } from "@/components/ui/badge";

export function CapabilityPanel({ baseUrl }: { baseUrl: string }) {
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);

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
              {resources.map((r) => (
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
      )}

      <ResponseView res={res} />
    </div>
  );
}
