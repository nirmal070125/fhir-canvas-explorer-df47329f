import { useRef, useState } from "react";
import { fhirFetch, type FhirResponse } from "@/lib/fhir-client";

/** Shared request state for the explorer panels: latest response, loading flag, and a run() that never throws (network errors become a status-0 response). */
export function useFhirRequest(baseUrl: string) {
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);
  // Sequence guard: only the latest run() may write state, so a slow earlier
  // request can't overwrite the result of a newer one.
  const seq = useRef(0);

  async function run(path: string, init: RequestInit = {}) {
    const id = ++seq.current;
    setLoading(true);
    try {
      const next = await fhirFetch(path, init, baseUrl);
      if (id === seq.current) setRes(next);
    } catch (e: unknown) {
      if (id === seq.current) {
        setRes({
          status: 0,
          ok: false,
          headers: {},
          body: { error: e instanceof Error ? e.message : String(e) },
          raw: "",
          url: "",
          method: typeof init.method === "string" ? init.method : "GET",
          durationMs: 0,
        });
      }
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }

  return { res, loading, run };
}
