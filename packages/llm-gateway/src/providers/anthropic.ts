import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMProviderConfig, GatewayQueryRequest, GatewayQueryResponse } from '../types.js';

function buildMessages(request: GatewayQueryRequest) {
  const messages: Anthropic.MessageParam[] = [];

  if (request.conversationHistory) {
    for (const msg of request.conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  const queryText = request.contextData
    ? `${request.contextData}\n\n---\n\nUser Query: ${request.query}`
    : request.query;

  if (request.attachments && request.attachments.length > 0) {
    const contentBlocks: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];

    const docs = request.attachments.filter(a => a.category === 'document' && a.textContent);
    if (docs.length > 0) {
      const docContext = docs.map(a => `[Attached file: ${a.filename}]\n${a.textContent}`).join('\n\n---\n\n');
      contentBlocks.push({ type: 'text', text: `ATTACHED DOCUMENTS:\n\n${docContext}\n\n---\n\n` });
    }

    const images = request.attachments.filter(a => a.category === 'image' && a.base64Data);
    for (const img of images) {
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
          data: img.base64Data!,
        },
      });
    }

    contentBlocks.push({ type: 'text', text: queryText });
    messages.push({ role: 'user', content: contentBlocks });
  } else {
    messages.push({ role: 'user', content: queryText });
  }

  return messages;
}

function buildParams(request: GatewayQueryRequest, config: LLMProviderConfig, messages: Anthropic.MessageParam[]) {
  const model = config.thinkingMode?.modelOverride || config.model;
  if (!model) throw new Error('No model specified for Anthropic provider.');

  const thinkingEnabled = config.thinkingMode?.enabled &&
    (model.includes('claude-sonnet-4') || model.includes('claude-3-7'));

  const requestParams: Anthropic.MessageCreateParams = {
    model,
    max_tokens: request.maxTokens || 4096,
    system: request.systemPrompt,
    messages,
  };

  if (thinkingEnabled) {
    (requestParams as Anthropic.MessageCreateParams & { thinking?: { type: string; budget_tokens: number } }).thinking = {
      type: 'enabled',
      budget_tokens: config.thinkingMode?.budgetTokens || 10000,
    };
  }

  return { requestParams, model };
}

export const anthropicProvider: LLMProvider = {
  name: 'anthropic',

  async query(request: GatewayQueryRequest, config: LLMProviderConfig): Promise<GatewayQueryResponse> {
    const client = new Anthropic({ apiKey: config.apiKey });
    const messages = buildMessages(request);
    const { requestParams, model } = buildParams(request, config, messages);
    const response = await client.messages.create(requestParams);

    let content = '';
    let thinkingTokens = 0;

    for (const block of response.content) {
      if (block.type === 'text') content = block.text;
      else if ((block as { type: string }).type === 'thinking') {
        thinkingTokens = (response.usage as Anthropic.Usage & { thinking_tokens?: number })?.thinking_tokens || 0;
      }
    }

    return {
      content,
      confidence: 0.85,
      sources: [{ type: 'model', description: `Claude (${model})` }],
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      thinkingTokens,
      modelUsed: response.model,
      providerName: 'anthropic',
    };
  },

  async streamQuery(
    request: GatewayQueryRequest,
    config: LLMProviderConfig,
    onChunk: (text: string) => void
  ): Promise<GatewayQueryResponse> {
    const client = new Anthropic({ apiKey: config.apiKey });
    const messages = buildMessages(request);
    const { requestParams, model } = buildParams(request, config, messages);
    const stream = client.messages.stream(requestParams);

    let content = '';
    stream.on('text', (text) => { content += text; onChunk(text); });

    const finalMessage = await stream.finalMessage();

    return {
      content,
      confidence: 0.85,
      sources: [{ type: 'model', description: `Claude (${model})` }],
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
      thinkingTokens: (finalMessage.usage as any)?.thinking_tokens || 0,
      modelUsed: finalMessage.model,
      providerName: 'anthropic',
    };
  },
};
