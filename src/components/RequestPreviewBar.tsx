import type { ReactNode } from "react";

/** Shared request-preview bar: highlighted method + truncated path, with the panel's action button(s) in `children`. `framed={false}` drops the border/background so a parent can supply its own frame. */
export function RequestPreviewBar({
  method,
  path,
  children,
  framed = true,
}: {
  method: string;
  path: string;
  children?: ReactNode;
  framed?: boolean;
}) {
  const row = (
    <div className="flex items-center gap-3 px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-xs">
        <span className="mr-2 font-semibold text-primary">{method}</span>
        {path}
      </code>
      {children}
    </div>
  );
  if (!framed) return row;
  return <div className="rounded-md border bg-muted/30">{row}</div>;
}
