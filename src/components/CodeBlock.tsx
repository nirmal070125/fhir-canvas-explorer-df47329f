import { useMemo } from "react";
import { cn } from "@/lib/utils";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-turtle";

// Read-only Prism code block; payloads above this size render as plain text since highlighting them locks the main thread.
const MAX_HIGHLIGHT_CHARS = 1_500_000;

export type CodeLanguage = "json" | "xml" | "turtle";

const GRAMMAR: Record<CodeLanguage, string> = {
  json: "json",
  xml: "markup",
  turtle: "turtle",
};

export function CodeBlock({
  code,
  language,
  className,
}: {
  code: string;
  language: CodeLanguage;
  className?: string;
}) {
  const html = useMemo(() => {
    if (code.length > MAX_HIGHLIGHT_CHARS) return null;
    const grammar = Prism.languages[GRAMMAR[language]];
    return grammar ? Prism.highlight(code, grammar, GRAMMAR[language]) : null;
  }, [code, language]);

  const cls = cn(
    "max-h-[600px] overflow-auto rounded-md border bg-card p-3 font-mono text-xs leading-relaxed",
    className,
  );
  if (html === null) return <pre className={cls}>{code}</pre>;
  return <pre className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
}
