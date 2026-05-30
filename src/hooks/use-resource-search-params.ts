import { useMemo } from "react";
import { useCapabilityResources } from "./use-capabilities";
import {
  mergeSearchParams,
  type SearchParamDef,
  type SearchParamType,
} from "@/lib/fhir-search-params";

export interface ResourceSearchParams {
  /** Ordered: resource-specific params first, then common result/meta params. */
  params: SearchParamDef[];
  /** Lookup by parameter name (for value hints, type badges). */
  byName: Map<string, SearchParamDef>;
}

/**
 * Search parameters available for `resourceType`, merging the curated catalogue
 * with what the server advertises in its CapabilityStatement.
 */
export function useResourceSearchParams(
  resourceType: string,
  baseUrl: string,
): ResourceSearchParams {
  const resources = useCapabilityResources(baseUrl);

  return useMemo(() => {
    const fromCapability: SearchParamDef[] = (resources.get(resourceType)?.searchParam ?? []).map(
      (sp) => ({
        name: sp.name,
        type: sp.type as SearchParamType | undefined,
        documentation: sp.documentation,
      }),
    );
    const params = mergeSearchParams(resourceType, fromCapability);
    return { params, byName: new Map(params.map((p) => [p.name, p])) };
  }, [resources, resourceType]);
}
