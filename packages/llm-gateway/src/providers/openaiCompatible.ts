/**
 * OpenAI-compatible provider factory.
 * Used by Perplexity, Grok, and Mistral which all use OpenAI-compatible APIs.
 */

import OpenAI from 'openai';
import type { LLMProvider, LLMProviderName, LLMProviderConfig, GatewayQueryRequest, GatewayQueryResponse } from '../types.js';

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

interface OpenAICompatibleOptions {
  name: LLMProviderName;
  defaultBaseUrl: string;
  defaultModel: string;
  extraSources?: Array<{ type: 'model' | 'context' | 'web'; description: string }>;
}

function buildMessages(request: GatewayQueryRequest): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: request.systemPrompt }];

  if (request.conversationHistory) {
    for (const msg of request.conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  let userContent = request.query;
  if (request.contextData) userContent = `${request.contextData}\n\n---\n\nUser Query: ${request.query}`;

  if (request.attachments && request.attachments.length > 0) {
    const docs = request.attachments.filter(a => a.category === 'document' && a.textContent);
    if (docs.length > 0) {
      const docContext = docs.map(a => `[${a.filename}]\n${a.textContent}`).join('\n\n---\n\n');
      userContent = `ATTACHED DOCUMENTS:\n\n${docContext}\n\n---\n\n${userContent}`;
    }
  }

  messages.push({ role: 'user', content: userContent });
  return messages;
}

export function createOpenAICompatibleProvider(options: OpenAICompatibleOptions): LLMProvider {
  return {
    name: options.name,

    async query(request: GatewayQueryRequest, config: LLMProviderConfig): Promise<GatewayQueryResponse> {
      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || options.defaultBaseUrl,
      });

      const model = config.thinkingMode?.modelOverride || config.model || options.defaultModel;
      const messages = buildMessages(request);

      const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: request.maxTokens || 4096,
        temperature: 0.7,
      });

      const choice = response.choices[0];
      const sources = [
        { type: 'model' as const, description: `${options.name.charAt(0).toUpperCase() + options.name.slice(1)} (${model})` },
        ...(options.extraSources || []),
      ];

      return {
        content: choice.message.content || '',
        confidence: 0.85,
        sources,
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        modelUsed: response.model,
        providerName: options.name,
      };
    },

    async streamQuery(
      request: GatewayQueryRequest,
      config: LLMProviderConfig,
      onChunk: (text: string) => void
    ): Promise<GatewayQueryResponse> {
      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || options.defaultBaseUrl,
      });

      const model = config.thinkingMode?.modelOverride || config.model || options.defaultModel;
      const messages = buildMessages(request);

      const stream = await client.chat.completions.create({
        model,
        messages,
        max_tokens: request.maxTokens || 4096,
        temperature: 0.7,
        stream: true,
        stream_options: { include_usage: true },
      });

      let content = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let modelUsed = model;

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) { content += delta; onChunk(delta); }
        if (chunk.usage) { inputTokens = chunk.usage.prompt_tokens || 0; outputTokens = chunk.usage.completion_tokens || 0; }
        if (chunk.model) modelUsed = chunk.model;
      }

      const sources = [
        { type: 'model' as const, description: `${options.name.charAt(0).toUpperCase() + options.name.slice(1)} (${model})` },
        ...(options.extraSources || []),
      ];

      return {
        content,
        confidence: 0.85,
        sources,
        inputTokens, outputTokens, modelUsed, providerName: options.name,
      };
    },
  };
}

export const perplexityProvider = createOpenAICompatibleProvider({
  name: 'perplexity',
  defaultBaseUrl: 'https://api.perplexity.ai',
  defaultModel: 'sonar-pro',
  extraSources: [{ type: 'web', description: 'Web search results' }],
});

export const grokProvider = createOpenAICompatibleProvider({
  name: 'grok',
  defaultBaseUrl: 'https://api.x.ai/v1',
  defaultModel: 'grok-4',
});

export const mistralProvider = createOpenAICompatibleProvider({
  name: 'mistral',
  defaultBaseUrl: 'https://api.mistral.ai/v1',
  defaultModel: 'mistral-large-latest',
});
