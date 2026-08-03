import type { ReactNode } from "react";

/**
 * Two-column panel layout: request form on the left, response on the right
 * (sticky, so it stays visible while tweaking the form). Stacks vertically
 * below lg so nothing changes on small screens.
 */
export function PanelSplit({ form, response }: { form: ReactNode; response: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="min-w-0 space-y-4">{form}</div>
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">{response}</div>
    </div>
  );
}
