import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Standard labeled form field: Label over the control with the panels' shared spacing. */
export function Field({
  label,
  htmlFor,
  children,
  className = "space-y-1.5",
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
