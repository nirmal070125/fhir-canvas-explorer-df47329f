import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

/** Section of repeatable rows with the shared "Label + Add row" header. */
export function RowSection({
  label,
  addLabel,
  onAdd,
  children,
}: {
  label: ReactNode;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" /> {addLabel}
        </Button>
      </div>
      {children}
    </div>
  );
}

/** Ghost trash-icon button used to delete one row. */
export function RemoveRowButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label={ariaLabel}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
