import { useState } from "react";
import { fhirFetch, type FhirResponse } from "@/lib/fhir-client";

/** Shared request state for the explorer panels: latest response, loading flag, and a run() that never throws (network errors become a status-0 response). */
export function useFhirRequest(baseUrl: string) {
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(path: string, init: RequestInit = {}) {
    setLoading(true);
    try {
      setRes(await fhirFetch(path, init, baseUrl));
    } catch (e: any) {
      setRes({
        status: 0, ok: false, headers: {}, body: { error: e?.message }, raw: "",
        url: "", method: typeof init.method === "string" ? init.method : "GET", durationMs: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  return { res, loading, run };
}
