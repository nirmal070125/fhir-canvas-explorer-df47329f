import { useMemo } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-turtle";

// Prism on multi-megabyte payloads locks the main thread; beyond this size
// render plain text instead. 1.5MB covers this server's pretty-printed
// CapabilityStatement (~900KB JSON / ~690KB Turtle) with headroom.
const MAX_HIGHLIGHT_CHARS = 1_500_000;

export type CodeLanguage = "json" | "xml" | "turtle";

const GRAMMAR: Record<CodeLanguage, string> = {
  json: "json",
  xml: "markup",
  turtle: "turtle",
};

/** Syntax-highlighted read-only code block (shares the Prism token palette). */
export function CodeBlock({ code, language }: { code: string; language: CodeLanguage }) {
  const html = useMemo(() => {
    if (code.length > MAX_HIGHLIGHT_CHARS) return null;
    const grammar = Prism.languages[GRAMMAR[language]];
    return grammar ? Prism.highlight(code, grammar, GRAMMAR[language]) : null;
  }, [code, language]);

  const cls =
    "max-h-[600px] overflow-auto rounded-md border bg-card p-3 font-mono text-xs leading-relaxed";
  if (html === null) return <pre className={cls}>{code}</pre>;
  return <pre className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
}
