"use client";

import { Bot } from "lucide-react";
import { ChatComposer, PoweredBy, SuggestionButtons } from "./ChatComposer";
import type { ChatComposerProps } from "@/lib/fhir-chat-types";

interface EmptyChatProps extends Omit<ChatComposerProps, "compact"> {
  suggestions: string[];
  onSelectSuggestion: (suggestion: string) => void;
}

export function EmptyChat({
  input,
  busy,
  status,
  suggestions,
  onInputChange,
  onSubmit,
  onStop,
  onSelectSuggestion,
}: EmptyChatProps) {
  return (
    <div className="flex min-h-0 flex-1 animate-in justify-center overflow-y-auto px-5 pt-[clamp(3.5rem,10vh,5.5rem)] pb-6 fade-in duration-300 motion-reduce:animate-none">
      <div className="w-full max-w-[360px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <Bot className="size-6" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight">Explore your FHIR data</h3>
          <p className="mt-1.5 max-w-[32ch] text-sm leading-relaxed text-muted-foreground">
            Search resources, inspect capabilities, and read records without changing data.
          </p>
        </div>
        <ChatComposer
          compact={false}
          input={input}
          busy={busy}
          status={status}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onStop={onStop}
        />
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Try asking</p>
          <SuggestionButtons suggestions={suggestions} busy={busy} onSelect={onSelectSuggestion} />
        </div>
        <div className="mt-2">
          <PoweredBy />
        </div>
      </div>
    </div>
  );
}
