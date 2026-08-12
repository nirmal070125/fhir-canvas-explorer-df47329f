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
  // Blocks Send (but not typing) while a rate limit or budget notice is active.
  sendDisabled?: boolean;
}
