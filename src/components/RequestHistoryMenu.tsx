import { useEffect, useState } from "react";
import { History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getHistory,
  clearHistory,
  onHistoryChange,
  type HistoryEntry,
} from "@/lib/request-history";
import { useExplorerBus } from "@/lib/explorer-bus";
import { cn } from "@/lib/utils";

/** Dropdown listing recent requests; clicking one replays it in the Raw tab. */
export function RequestHistoryMenu() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const bus = useExplorerBus();

  useEffect(() => {
    setEntries(getHistory());
    return onHistoryChange(() => setEntries(getHistory()));
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label="Request history">
          <History className="h-4 w-4" />
          History
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-96 overflow-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          Recent requests
          {entries.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {entries.length === 0 && (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No requests yet.
          </div>
        )}
        {entries.map((e, i) => (
          <DropdownMenuItem
            key={i}
            onClick={() => bus?.openRaw({ method: e.method, path: e.path })}
            className="gap-2 font-mono text-xs"
            title="Open in Raw Request tab"
          >
            <span
              className={cn(
                "w-12 shrink-0 font-semibold",
                e.status >= 200 && e.status < 300
                  ? "text-primary"
                  : e.status >= 400 || e.status === 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {e.method}
            </span>
            <span className="min-w-0 flex-1 truncate">{e.path}</span>
            <span className="shrink-0 text-muted-foreground">{e.status || "ERR"}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
