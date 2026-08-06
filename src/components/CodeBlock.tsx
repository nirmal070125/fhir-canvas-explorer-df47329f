import { useMemo } from "react";
import { cn } from "@/lib/utils";
import Prism from "prismjs";
import "prismjs/components/prism-json";

// Read-only Prism code block; payloads above this size render as plain text since highlighting them locks the main thread.
const MAX_HIGHLIGHT_CHARS = 1_500_000;

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  const html = useMemo(() => {
    if (code.length > MAX_HIGHLIGHT_CHARS) return null;
    const grammar = Prism.languages.json;
    return grammar ? Prism.highlight(code, grammar, "json") : null;
  }, [code]);

  const cls = cn(
    "max-h-[600px] overflow-auto rounded-md border bg-card p-3 font-mono text-xs leading-relaxed",
    className,
  );
  if (html === null) return <pre className={cls}>{code}</pre>;
  // Safe: Prism.highlight HTML-escapes token content before wrapping it in spans.
  return <pre className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
}
