import type { ChatStatus, UIMessage } from "ai";

export interface FhirChatMessageMetadata {
  elapsedMs: number;
  fhirCalls: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type FhirChatMessage = UIMessage<FhirChatMessageMetadata>;

export interface ChatComposerProps {
  compact: boolean;
  input: string;
  busy: boolean;
  status: ChatStatus;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop: () => void;
  // A rate limit or budget notice is active: block typing + Send and dim the
  // composer. blockedLabel is the short reason shown as the placeholder (the
  // aria-live notice above stays the accessible source of truth).
  sendDisabled?: boolean;
  blockedLabel?: string;
}
