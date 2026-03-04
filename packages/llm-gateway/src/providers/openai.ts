import OpenAI from 'openai';
import type { LLMProvider, LLMProviderConfig, GatewayQueryRequest, GatewayQueryResponse } from '../types.js';

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const COMPLETION_TOKENS_MODELS = ['o1', 'o1-mini', 'o1-preview', 'o3', 'o3-mini', 'gpt-5', 'gpt-5-mini'];

function usesMaxCompletionTokens(model: string): boolean {
  return COMPLETION_TOKENS_MODELS.some(rm => model.includes(rm));
}

function supportsSystemRole(model: string): boolean {
  return !model.includes('o1') && !model.includes('o3');
}

function buildMessages(request: GatewayQueryRequest, model: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const supportsSystem = supportsSystemRole(model);

  if (supportsSystem) messages.push({ role: 'system', content: request.systemPrompt });

  if (request.conversationHistory) {
    for (const msg of request.conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  let userContent = request.query;
  if (request.contextData) userContent = `${request.contextData}\n\n---\n\nUser Query: ${request.query}`;
  if (!supportsSystem) userContent = `${request.systemPrompt}\n\n---\n\n${userContent}`;

  if (request.attachments && request.attachments.length > 0) {
    const docs = request.attachments.filter(a => a.category === 'document' && a.textContent);
    if (docs.length > 0) {
      const docContext = docs.map(a => `[${a.filename}]\n${a.textContent}`).join('\n\n---\n\n');
      userContent = `ATTACHED DOCUMENTS:\n\n${docContext}\n\n---\n\n${userContent}`;
    }

    const images = request.attachments.filter(a => a.category === 'image' && a.base64Data);
    if (images.length > 0) {
      const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
      for (const img of images) {
        parts.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` } });
      }
      parts.push({ type: 'text', text: userContent });
      messages.push({ role: 'user', content: parts });
    } else {
      messages.push({ role: 'user', content: userContent });
    }
  } else {
    messages.push({ role: 'user', content: userContent });
  }

  return messages;
}

export const openaiProvider: LLMProvider = {
  name: 'openai',

  async query(request: GatewayQueryRequest, config: LLMProviderConfig): Promise<GatewayQueryResponse> {
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    const model = config.model || 'gpt-4o';
    const usesCompletionTokensParam = usesMaxCompletionTokens(model);
    const messages = buildMessages(request, model);
    const maxTokens = request.maxTokens || 4096;

    const response = await client.chat.completions.create({
      model,
      messages,
      ...(usesCompletionTokensParam ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
      ...(!usesCompletionTokensParam ? { temperature: 0.7 } : {}),
    });

    const choice = response.choices[0];
    const usage = response.usage as OpenAI.CompletionUsage & { reasoning_tokens?: number };

    return {
      content: choice.message.content || '',
      confidence: 0.85,
      sources: [{ type: 'model', description: `GPT (${model})` }],
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      thinkingTokens: usage?.reasoning_tokens || 0,
      modelUsed: response.model,
      providerName: 'openai',
    };
  },

  async streamQuery(
    request: GatewayQueryRequest,
    config: LLMProviderConfig,
    onChunk: (text: string) => void
  ): Promise<GatewayQueryResponse> {
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    const model = config.model || 'gpt-4o';
    const usesCompletionTokensParam = usesMaxCompletionTokens(model);
    const messages = buildMessages(request, model);
    const maxTokens = request.maxTokens || 4096;

    const stream = await client.chat.completions.create({
      model, messages, stream: true, stream_options: { include_usage: true },
      ...(usesCompletionTokensParam ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
      ...(!usesCompletionTokensParam ? { temperature: 0.7 } : {}),
    });

    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) { content += delta; onChunk(delta); }
      if (chunk.usage) { inputTokens = chunk.usage.prompt_tokens || 0; outputTokens = chunk.usage.completion_tokens || 0; }
    }

    return {
      content,
      confidence: 0.85,
      sources: [{ type: 'model', description: `GPT (${model})` }],
      inputTokens, outputTokens, modelUsed: model, providerName: 'openai',
    };
  },
};
