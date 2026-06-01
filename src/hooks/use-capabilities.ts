import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fhirFetch } from "@/lib/fhir-client";

// Minimal shape of the bits of CapabilityStatement we consume.
export interface CapabilitySearchParam {
  name: string;
  type?: string;
  documentation?: string;
}
export interface CapabilityOperation {
  name: string;
  definition?: string;
  documentation?: string;
}
export interface CapabilityResource {
  type: string;
  interaction?: { code: string }[];
  searchParam?: CapabilitySearchParam[];
  operation?: CapabilityOperation[];
}
export interface CapabilityStatement {
  resourceType?: string;
  fhirVersion?: string;
  software?: { name?: string; version?: string };
  rest?: { resource?: CapabilityResource[]; operation?: CapabilityOperation[] }[];
}

/**
 * Shared query for a server's CapabilityStatement (`GET /metadata`). React Query
 * dedupes by base URL, so every panel that needs server metadata reuses a single
 * request instead of each refetching.
 */
export function useCapabilities(baseUrl: string) {
  return useQuery<CapabilityStatement>({
    queryKey: ["capabilities", baseUrl],
    queryFn: async () => {
      const res = await fhirFetch("/metadata", {}, baseUrl);
      if (!res.ok) throw new Error(`metadata request failed (${res.status})`);
      return (res.body ?? {}) as CapabilityStatement;
    },
    enabled: !!baseUrl,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** The resource definitions the server advertises, keyed by resource type. */
export function useCapabilityResources(baseUrl: string): Map<string, CapabilityResource> {
  const { data } = useCapabilities(baseUrl);
  return useMemo(() => {
    const map = new Map<string, CapabilityResource>();
    for (const r of data?.rest?.[0]?.resource ?? []) {
      if (r?.type) map.set(r.type, r);
    }
    return map;
  }, [data]);
}

/** Sorted list of resource types the server says it supports (may be empty). */
export function useSupportedResourceTypes(baseUrl: string): string[] {
  const resources = useCapabilityResources(baseUrl);
  return useMemo(() => [...resources.keys()].sort((a, b) => a.localeCompare(b)), [resources]);
}

/** System-level operations the server advertises in rest.operation (may be empty). */
export function useSystemOperations(baseUrl: string): CapabilityOperation[] {
  const { data } = useCapabilities(baseUrl);
  return useMemo(() => data?.rest?.[0]?.operation ?? [], [data]);
}
