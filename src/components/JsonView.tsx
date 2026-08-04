import { memo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FHIR_R4_RESOURCE_TYPES } from "@/lib/fhir-resources";
import { useExplorerBus } from "@/lib/explorer-bus";
import { CodeBlock } from "./CodeBlock";

/** Collapsible highlighted JSON tree; FHIR `Type/id` references open the Read tab and http(s) URLs become external links. */

// Above this many total nodes the tree renderer becomes sluggish, so fall back to a flat code block.
const MAX_NODES = 20_000;
const COLLAPSE_DEPTH = 4;

const RESOURCE_TYPE_SET = new Set<string>(FHIR_R4_RESOURCE_TYPES);
const REFERENCE_RE = /^([A-Za-z]+)\/([A-Za-z0-9\-.]{1,64})$/;
const DATE_RE = /^\d{4}(-\d{2}(-\d{2}(T[\d:.+\-Z]+)?)?)?$/;

function countNodes(v: unknown, budget: { n: number }): void {
  if (budget.n > MAX_NODES) return;
  budget.n++;
  if (Array.isArray(v)) for (const item of v) countNodes(item, budget);
  else if (v && typeof v === "object")
    for (const item of Object.values(v)) countNodes(item, budget);
}

export const JsonView = memo(function JsonView({ value }: { value: unknown }) {
  const budget = { n: 0 };
  countNodes(value, budget);
  // Too many nodes for the interactive tree — fall back to a flat highlighted code block.
  if (budget.n > MAX_NODES) {
    return <CodeBlock code={JSON.stringify(value, null, 2)} language="json" />;
  }
  return (
    <div className="max-h-[600px] overflow-auto rounded-md border bg-card p-3 font-mono text-xs leading-relaxed">
      <JsonNode value={value} depth={0} />
    </div>
  );
});

function JsonNode({
  name,
  value,
  depth,
  trailingComma,
}: {
  name?: string;
  value: unknown;
  depth: number;
  trailingComma?: boolean;
}) {
  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const entries: Array<[string | undefined, unknown]> = isArray
    ? (value as unknown[]).map((v) => [undefined, v])
    : isObject
      ? Object.entries(value as Record<string, unknown>)
      : [];
  const [open, setOpen] = useState(depth < COLLAPSE_DEPTH);

  const label = name !== undefined && (
    <>
      <span className="text-sky-700 dark:text-sky-300">"{name}"</span>
      <span className="text-muted-foreground">: </span>
    </>
  );
  const comma = trailingComma ? <span className="text-muted-foreground">,</span> : null;

  if (!isObject && !isArray) {
    return (
      <div style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
        {label}
        <JsonLeaf name={name} value={value} />
        {comma}
      </div>
    );
  }

  const [openBrace, closeBrace] = isArray ? ["[", "]"] : ["{", "}"];
  if (entries.length === 0) {
    return (
      <div style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
        {label}
        <span className="text-muted-foreground">{openBrace + closeBrace}</span>
        {comma}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center rounded hover:bg-muted/60"
      >
        <ChevronRight
          className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        {label}
        <span className="text-muted-foreground">{openBrace}</span>
        {!open && (
          <span className="text-muted-foreground">
            &nbsp;… {entries.length} {isArray ? "items" : "fields"} {closeBrace}
          </span>
        )}
      </button>
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode
              key={k ?? i}
              name={k}
              value={v}
              depth={depth + 1}
              trailingComma={i < entries.length - 1}
            />
          ))}
          <div>
            <span className="text-muted-foreground">{closeBrace}</span>
            {comma}
          </div>
        </>
      )}
    </div>
  );
}

function JsonLeaf({ name, value }: { name?: string; value: unknown }) {
  const bus = useExplorerBus();

  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === "boolean")
    return <span className="text-violet-700 dark:text-violet-300">{String(value)}</span>;
  if (typeof value === "number")
    return <span className="text-amber-700 dark:text-amber-300">{String(value)}</span>;

  const s = String(value);

  // FHIR reference — clickable, opens the Read tab prefilled.
  const ref = s.match(REFERENCE_RE);
  if (ref && RESOURCE_TYPE_SET.has(ref[1]) && (name === "reference" || name === undefined)) {
    return (
      <span className="text-emerald-700 dark:text-emerald-300">
        "
        <button
          type="button"
          className="underline decoration-dotted underline-offset-2 hover:text-emerald-900 dark:hover:text-emerald-100"
          onClick={() => bus?.openRead(ref[1], ref[2])}
          title={`Open ${s} in Read tab`}
        >
          {s}
        </button>
        "
      </span>
    );
  }

  if (/^https?:\/\//.test(s)) {
    return (
      <span className="text-emerald-700 dark:text-emerald-300">
        "
        <a
          href={s}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-dotted underline-offset-2"
        >
          {s}
        </a>
        "
      </span>
    );
  }

  if (DATE_RE.test(s)) return <span className="text-rose-700 dark:text-rose-300">"{s}"</span>;

  return <span className="text-emerald-700 dark:text-emerald-300">"{s}"</span>;
}
