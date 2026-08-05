"use client";

import { Check } from "lucide-react";
import { ChatComposer, PoweredBy, SuggestionButtons } from "./ChatComposer";
import { describeTool, isToolPart } from "./chat-state";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Spinner } from "@/components/ui/spinner";
import type {
  ChatComposerProps,
  FhirChatMessage,
  FhirChatMessageMetadata,
} from "@/lib/fhir-chat-types";

interface ActiveChatProps extends Omit<ChatComposerProps, "compact"> {
  messages: FhirChatMessage[];
  suggestions: string[];
  showFollowUps: boolean;
  activity?: string;
  error?: Error;
  onSelectSuggestion: (suggestion: string) => void;
}

interface ChatMessagePartProps {
  messageId: string;
  part: FhirChatMessage["parts"][number];
  index: number;
}

interface WorkloadSummaryProps {
  metadata?: FhirChatMessageMetadata;
}

function AssistantActivity({ label }: { label: string }) {
  return (
    <Message from="assistant">
      <MessageContent>
        <div
          role="status"
          aria-live="polite"
          className="flex w-fit items-center gap-2.5 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground"
        >
          <Spinner className="size-3.5 text-primary" />
          <span>{label}</span>
          <span aria-hidden="true" className="animate-pulse tracking-widest">
            ...
          </span>
        </div>
      </MessageContent>
    </Message>
  );
}

function WorkloadSummary({ metadata }: WorkloadSummaryProps) {
  if (!metadata) return null;

  const seconds = (metadata.elapsedMs / 1000).toFixed(1);
  const calls = `${metadata.fhirCalls} FHIR ${metadata.fhirCalls === 1 ? "call" : "calls"}`;
  const tokens =
    typeof metadata.totalTokens === "number"
      ? `${metadata.totalTokens.toLocaleString()} tokens`
      : undefined;

  return (
    <p className="mt-2 text-[11px] text-muted-foreground">
      {[calls, `${seconds}s`, tokens].filter(Boolean).join(" · ")}
    </p>
  );
}

function ChatMessagePart({ messageId, part, index }: ChatMessagePartProps) {
  const key = `${messageId}-${part.type}-${index}`;

  if (part.type === "text") {
    return (
      <MessageResponse key={key} className="max-w-full [&_code]:break-words [&_table]:text-xs">
        {part.text}
      </MessageResponse>
    );
  }

  if (!isToolPart(part)) return null;
  const state = "state" in part ? part.state : undefined;
  if (state !== "output-available") return null;

  return (
    <div
      key={key}
      className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
    >
      <Check className="size-3.5 shrink-0 text-emerald-600" />
      <span>{describeTool(part)}</span>
    </div>
  );
}

function ChatMessage({ message }: { message: FhirChatMessage }) {
  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, index) => (
          <ChatMessagePart
            key={`${message.id}-${part.type}-${index}`}
            messageId={message.id}
            part={part}
            index={index}
          />
        ))}
        {message.role === "assistant" && <WorkloadSummary metadata={message.metadata} />}
      </MessageContent>
    </Message>
  );
}

function ChatError({ error }: { error?: Error }) {
  if (!error) return null;

  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm text-destructive">
        {error.message || "The assistant could not complete that request."}
      </p>
    </div>
  );
}

export function ActiveChat({
  messages,
  suggestions,
  showFollowUps,
  activity,
  error,
  input,
  busy,
  status,
  onInputChange,
  onSubmit,
  onStop,
  onSelectSuggestion,
}: ActiveChatProps) {
  return (
    <>
      <Conversation className="min-h-0 animate-in fade-in duration-300 motion-reduce:animate-none">
        <ConversationContent className="gap-5">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {activity && <AssistantActivity label={activity} />}
          <ChatError error={error} />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="animate-in border-t bg-card px-3 pt-2 slide-in-from-bottom-3 duration-300 motion-reduce:animate-none">
        {showFollowUps && (
          <div className="pb-2">
            <SuggestionButtons
              suggestions={suggestions}
              busy={busy}
              onSelect={onSelectSuggestion}
              compact
            />
          </div>
        )}
        <ChatComposer
          compact
          input={input}
          busy={busy}
          status={status}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onStop={onStop}
        />
        <PoweredBy compact />
      </div>
    </>
  );
}
