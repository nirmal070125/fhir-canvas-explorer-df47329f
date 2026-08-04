export interface Choice<T extends string> {
  value: T;
  label: string;
  desc: string;
}

/** Shared grid of selectable label+description cards used by the panel interaction/scope pickers. */
export function ChoiceCards<T extends string>({
  choices,
  value,
  onChange,
  gridClass = "grid grid-cols-2 gap-2 sm:grid-cols-3",
}: {
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  gridClass?: string;
}) {
  return (
    <div className={gridClass}>
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          aria-pressed={value === c.value}
          className={
            "rounded-md border px-3 py-2 text-left transition-colors " +
            (value === c.value
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "bg-card hover:bg-muted/50")
          }
        >
          <span className="block text-sm font-medium">{c.label}</span>
          <span className="mt-0.5 block min-h-8 text-[11px] leading-snug text-muted-foreground">
            {c.desc}
          </span>
        </button>
      ))}
    </div>
  );
}
