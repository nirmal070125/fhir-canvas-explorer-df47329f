import type { FhirResponse } from "./fhir-client";

export interface OperationOutcomeIssue {
  severity?: "fatal" | "error" | "warning" | "information" | string;
  code?: string;
  diagnostics?: string;
  details?: { text?: string };
  expression?: string[];
}
export interface OperationOutcome {
  resourceType: "OperationOutcome";
  issue?: OperationOutcomeIssue[];
}

/** Returns the body as an OperationOutcome if it is one, else null. */
export function getOperationOutcome(body: unknown): OperationOutcome | null {
  if (
    body &&
    typeof body === "object" &&
    (body as { resourceType?: string }).resourceType === "OperationOutcome"
  ) {
    return body as OperationOutcome;
  }
  return null;
}

/** Human-readable text for an issue (diagnostics, falling back to details.text). */
export function issueText(issue: OperationOutcomeIssue): string {
  const parts = [issue.diagnostics || issue.details?.text || ""];
  if (issue.expression?.length) parts.push(`(${issue.expression.join(", ")})`);
  return parts.filter(Boolean).join(" ");
}

/**
 * Suggested download filename for a response. Uses the resource type + id when
 * the body is a single resource, the resource type for a Bundle, else a generic
 * name. Always ends in .json.
 */
export function responseFileName(res: FhirResponse): string {
  const body = res.body as { resourceType?: string; id?: string } | undefined;
  if (body && typeof body === "object" && body.resourceType) {
    if (body.resourceType === "Bundle") return "bundle.json";
    return body.id ? `${body.resourceType}-${body.id}.json` : `${body.resourceType}.json`;
  }
  return "response.json";
}
