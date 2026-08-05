import type { ReactNode } from "react";

/** Row-based layout: request form on top, response below at full width. */
export function PanelSplit({ form, response }: { form: ReactNode; response: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="min-w-0 space-y-4">{form}</div>
      <div className="min-w-0">{response}</div>
    </div>
  );
}
