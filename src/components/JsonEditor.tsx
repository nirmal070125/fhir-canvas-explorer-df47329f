import { useMemo } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import { cn } from "@/lib/utils";

/**
 * JSON editor: react-simple-code-editor (transparent textarea over a
 * highlighted mirror) with Prism's JSON grammar. Native textarea behavior
 * (undo, IME, paste) is preserved; a parse error shows below the editor.
 */

interface Props {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  ariaLabel?: string;
}

export function JsonEditor({ value, onChange, rows = 14, className, ariaLabel }: Props) {
  const jsonError = useMemo(() => {
    if (!value.trim()) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (e: any) {
      return String(e?.message ?? "Invalid JSON");
    }
  }, [value]);

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "overflow-auto rounded-md border bg-card focus-within:ring-1 focus-within:ring-ring",
          jsonError && "border-destructive/60",
          className,
        )}
        style={{ maxHeight: `${rows * 1.625}em` }}
      >
        <Editor
          value={value}
          onValueChange={onChange}
          highlight={(code) => Prism.highlight(code, Prism.languages.json, "json")}
          padding={12}
          aria-label={ariaLabel ?? "JSON body"}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-full font-mono text-xs leading-relaxed [&>textarea]:outline-none"
        />
      </div>
      {jsonError && (
        <p className="text-xs text-destructive" role="status">
          {jsonError}
        </p>
      )}
    </div>
  );
}
