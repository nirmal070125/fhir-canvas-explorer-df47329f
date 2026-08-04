import { memo } from "react";
import { JsonViewer, defineDataType } from "@textea/json-viewer";
import { FHIR_R4_RESOURCE_TYPES } from "@/lib/fhir-resources";
import { useExplorerBus } from "@/lib/explorer-bus";
import { CodeBlock } from "./CodeBlock";

/** Collapsible highlighted JSON tree; FHIR `Type/id` references open the Read tab and http(s) URLs become external links. */

// Above this many total nodes the tree renderer becomes sluggish, so fall back to a flat code block.
const MAX_NODES = 20_000;
const COLLAPSE_DEPTH = 4;

const RESOURCE_TYPE_SET = new Set<string>(FHIR_R4_RESOURCE_TYPES);
const REFERENCE_RE = /^([A-Za-z]+)\/([A-Za-z0-9\-.]{1,64})$/;

function countNodes(v: unknown, budget: { n: number }): void {
  if (budget.n > MAX_NODES) return;
  budget.n++;
  if (Array.isArray(v)) for (const item of v) countNodes(item, budget);
  else if (v && typeof v === "object")
    for (const item of Object.values(v)) countNodes(item, budget);
}

function isFhirReference(value: unknown, path: (string | number)[]): value is string {
  if (typeof value !== "string") return false;
  const ref = value.match(REFERENCE_RE);
  const key = path[path.length - 1];
  return !!ref && RESOURCE_TYPE_SET.has(ref[1]) && (key === "reference" || typeof key === "number");
}

// Base16 theme matching the app's Prism palette; @textea/json-viewer slot usage (from its source): base07 keys, base09 strings, base0B numbers, base0D dates, base0E booleans, base08/base0F misc scalars, base03/base04 punctuation and counts.
const FHIR_THEME = {
  scheme: "fhir-explorer",
  author: "wso2",
  base00: "transparent", // background
  base01: "#f1f5f9",
  base02: "#e2e8f0",
  base03: "#64748b", // punctuation / item counts (slate-500)
  base04: "#64748b",
  base05: "#0f172a", // default text
  base06: "#0f172a",
  base07: "#0369a1", // object keys (sky-700)
  base08: "#64748b", // null / undefined (muted)
  base09: "#047857", // strings (emerald-700)
  base0A: "#6d28d9",
  base0B: "#b45309", // numbers (amber-700)
  base0C: "#0369a1",
  base0D: "#be123c", // dates (rose-700)
  base0E: "#6d28d9", // booleans (violet-700)
  base0F: "#b45309", // ints (amber-700)
};

const urlType = defineDataType<string>({
  is: (value) => typeof value === "string" && /^https?:\/\//.test(value),
  Component: ({ value }) => (
    <span className="jv-string">
      "
      <a
        href={value}
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-dotted underline-offset-2"
      >
        {value}
      </a>
      "
    </span>
  ),
});

export const JsonView = memo(function JsonView({ value }: { value: unknown }) {
  const bus = useExplorerBus();
  const budget = { n: 0 };
  countNodes(value, budget);
  // Too many nodes for the interactive tree — fall back to a flat highlighted code block.
  if (budget.n > MAX_NODES) {
    return <CodeBlock code={JSON.stringify(value, null, 2)} language="json" />;
  }

  const fhirReferenceType = defineDataType<string>({
    is: isFhirReference,
    Component: ({ value }) => {
      const ref = value.match(REFERENCE_RE)!;
      return (
        <span className="jv-string">
          "
          <button
            type="button"
            className="underline decoration-dotted underline-offset-2"
            onClick={() => bus?.openRead(ref[1], ref[2])}
            title={`Open ${value} in Read tab`}
          >
            {value}
          </button>
          "
        </span>
      );
    },
  });

  return (
    <div className="fhir-json-view max-h-[600px] overflow-auto rounded-md border bg-card p-3 font-mono text-xs leading-relaxed">
      <JsonViewer
        value={value}
        defaultInspectDepth={COLLAPSE_DEPTH}
        valueTypes={[fhirReferenceType, urlType]}
        enableClipboard={false}
        displayDataTypes={false}
        displaySize={false}
        rootName={false}
        theme={FHIR_THEME}
        style={{ backgroundColor: "transparent", fontFamily: "inherit", fontSize: "inherit" }}
      />
    </div>
  );
});
