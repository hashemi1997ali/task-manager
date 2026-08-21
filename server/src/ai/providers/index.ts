/**
 * Provider registry.
 *
 * The active provider is chosen by the `AI_PROVIDER` env var (preserving the
 * original behaviour). `runProviders` tries the selected provider and returns
 * the first successful reply. If it fails or is unconfigured, the caller gets
 * an explicit unavailable state.
 */

import type { AssistantHistoryMessage } from "../types.ts";
import type {
  ChatProvider,
  ProviderRequest,
  ProviderToolCall,
  ProviderToolDefinition,
} from "./types.ts";
import { anthropicProvider } from "./anthropic.ts";
import { geminiProvider } from "./gemini.ts";
import { ollamaProvider } from "./ollama.ts";
import { openAiProvider, openRouterProvider } from "./openai.ts";

export type {
  ChatProvider,
  ProviderRequest,
  ProviderToolCall,
  ProviderToolDefinition,
} from "./types.ts";

const REGISTRY: Record<string, ChatProvider> = {
  openai: openAiProvider,
  openrouter: openRouterProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
};

/** Reads and normalises the configured provider name. */
export const getConfiguredProviderName = (): string =>
  (process.env.AI_PROVIDER ?? "none").trim().toLowerCase();

/**
 * Returns the ordered list of providers to attempt. Currently this is the
 * single provider selected by `AI_PROVIDER`, but the array shape allows a
 * future multi-provider chain without changing the orchestrator.
 */
export const getActiveProviders = (): ChatProvider[] => {
  const provider = REGISTRY[getConfiguredProviderName()];
  return provider ? [provider] : [];
};

export interface ProviderRunResult {
  text: string;
  provider: string;
  toolCalls: ProviderToolCall[];
}

/**
 * Attempts each active provider in order and returns the first success.
 * Returns `null` when no provider is configured or every attempt fails.
 */
export const runProviders = async (params: {
  systemPrompt: string;
  history: AssistantHistoryMessage[];
  message: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ProviderToolDefinition[];
}): Promise<ProviderRunResult | null> => {
  const request: ProviderRequest = {
    systemPrompt: params.systemPrompt,
    history: params.history,
    message: params.message,
    temperature: params.temperature ?? 0.2,
    maxTokens: params.maxTokens ?? 700,
    tools: params.tools,
  };

  for (const provider of getActiveProviders()) {
    if (!provider.isConfigured()) continue;
    try {
      const completion = await provider.complete(request);
      return { ...completion, provider: provider.name };
    } catch (error) {
      console.error(`AI provider ${provider.name} failed:`, error);
    }
  }

  return null;
};
