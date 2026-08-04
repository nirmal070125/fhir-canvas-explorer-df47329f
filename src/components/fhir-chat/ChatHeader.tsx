"use client";

import { Bot, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  baseUrl: string;
  hasMessages: boolean;
  onClear: () => void;
  onClose: () => void;
}

export function ChatHeader({ baseUrl, hasMessages, onClear, onClose }: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b px-4 py-3">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">FHIR Assistant</h2>
        <p className="truncate text-xs text-muted-foreground" title={baseUrl}>
          Read-only access to {baseUrl}
        </p>
      </div>
      {hasMessages && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onClear}
          aria-label="Clear conversation"
          title="Clear conversation"
        >
          <RotateCcw className="size-4" />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={onClose}
        aria-label="Close FHIR assistant"
      >
        <X className="size-4" />
      </Button>
    </header>
  );
}
