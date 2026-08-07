import type { ReactNode } from "react";
import type { FhirResponse } from "@/lib/fhir-client";
import { PanelSplit } from "./PanelSplit";
import { ResponseView } from "../ResponseView";

/** Shared panel frame: form fields (children) on the left, ResponseView on the right, with optional `responseExtra` content above the response. */
export function BasePanel({
  res,
  children,
  responseExtra,
}: {
  res: FhirResponse | null;
  children: ReactNode;
  responseExtra?: ReactNode;
}) {
  const response = responseExtra ? (
    <div className="space-y-3">
      {responseExtra}
      <ResponseView res={res} />
    </div>
  ) : (
    <ResponseView res={res} />
  );
  return <PanelSplit form={<div className="space-y-5">{children}</div>} response={response} />;
}
