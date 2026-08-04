import type { ReactNode } from "react";
import { Field as UIField, FieldLabel } from "@/components/ui/field";

/** Thin adapter over shadcn's Field: label-as-prop API with the panels' tighter spacing. */
export function Field({
  label,
  htmlFor,
  children,
  className = "gap-1.5",
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <UIField className={className}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
    </UIField>
  );
}
