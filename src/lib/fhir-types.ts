/**
 * Minimal structural typings for the FHIR JSON the explorer reads.
 * Everything is optional because payloads come from arbitrary servers;
 * these types only name the fields the UI actually touches.
 */

export interface CodingLike {
  code?: string;
  display?: string;
}

export interface CodeableConceptLike {
  text?: string;
  coding?: CodingLike[];
}

export interface HumanNameLike {
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
}

export interface ResourceLike {
  resourceType?: string;
  id?: string;
  meta?: { versionId?: string };
  name?: HumanNameLike[] | string;
  code?: CodeableConceptLike;
  medicationCodeableConcept?: CodeableConceptLike;
  vaccineCode?: CodeableConceptLike;
  title?: string;
  description?: string;
  status?: string;
  class?: CodingLike;
  period?: { start?: string };
  value?: unknown;
}

export interface BundleLike {
  resourceType?: string;
  total?: number;
  entry?: { resource?: ResourceLike }[];
  link?: { relation: string; url: string }[];
}

export interface CapabilityResourceLike {
  type?: string;
  interaction?: { code: string }[];
  searchParam?: unknown[];
}

export interface CapabilityStatementLike {
  fhirVersion?: string;
  software?: { name?: string; version?: string };
  rest?: { resource?: CapabilityResourceLike[] }[];
}
