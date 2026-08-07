import {
  Choicebox,
  ChoiceboxItem,
  ChoiceboxItemHeader,
  ChoiceboxItemTitle,
  ChoiceboxItemDescription,
  ChoiceboxIndicator,
} from "@/components/kibo-ui/choicebox";

export interface Choice<T extends string> {
  value: T;
  label: string;
  desc: string;
}

/** Grid of selectable label+description cards for the panel interaction/scope pickers, backed by Kibo's Choicebox (Radix RadioGroup semantics). */
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
    <Choicebox value={value} onValueChange={(v) => onChange(v as T)} className={gridClass}>
      {choices.map((c) => (
        <ChoiceboxItem key={c.value} value={c.value} className="px-3 py-2">
          <ChoiceboxItemHeader>
            <ChoiceboxItemTitle>{c.label}</ChoiceboxItemTitle>
            <ChoiceboxItemDescription className="min-h-8 text-[11px] leading-snug">
              {c.desc}
            </ChoiceboxItemDescription>
          </ChoiceboxItemHeader>
          <ChoiceboxIndicator />
        </ChoiceboxItem>
      ))}
    </Choicebox>
  );
}
