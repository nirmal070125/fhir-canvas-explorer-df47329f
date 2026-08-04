import type { ReactNode } from "react";

/** Two-column layout: form left, sticky response right; stacks vertically below lg. */
export function PanelSplit({ form, response }: { form: ReactNode; response: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="min-w-0 space-y-4">{form}</div>
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">{response}</div>
    </div>
  );
}
