import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, LLMProviderConfig, GatewayQueryRequest, GatewayQueryResponse } from '../types.js';

function buildPrompt(request: GatewayQueryRequest): string {
  let userContent = request.query;
  if (request.contextData) userContent = `${request.contextData}\n\n---\n\nUser Query: ${request.query}`;
  if (request.attachments && request.attachments.length > 0) {
    const docs = request.attachments.filter(a => a.category === 'document' && a.textContent);
    if (docs.length > 0) {
      const docContext = docs.map(a => `[${a.filename}]\n${a.textContent}`).join('\n\n---\n\n');
      userContent = `ATTACHED DOCUMENTS:\n\n${docContext}\n\n---\n\n${userContent}`;
    }
  }
  return `${request.systemPrompt}\n\n## User Request:\n\n${userContent}`;
}

export const geminiProvider: LLMProvider = {
  name: 'gemini',

  async query(request: GatewayQueryRequest, config: LLMProviderConfig): Promise<GatewayQueryResponse> {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = config.thinkingMode?.modelOverride || config.model || 'gemini-1.5-pro';

    const generativeModel = genAI.getGenerativeModel({
      model,
      generationConfig: { temperature: 0.7, maxOutputTokens: request.maxTokens || 4096 },
    });

    const prompt = buildPrompt(request);
    const result = await generativeModel.generateContent(prompt);
    const response = result.response;
    const content = response.text();
    const usageMetadata = response.usageMetadata;

    return {
      content,
      confidence: 0.85,
      sources: [{ type: 'model', description: `Gemini (${model})` }],
      inputTokens: usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4),
      outputTokens: usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4),
      modelUsed: model,
      providerName: 'gemini',
    };
  },

  async streamQuery(
    request: GatewayQueryRequest,
    config: LLMProviderConfig,
    onChunk: (text: string) => void
  ): Promise<GatewayQueryResponse> {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = config.thinkingMode?.modelOverride || config.model || 'gemini-1.5-pro';

    const generativeModel = genAI.getGenerativeModel({
      model,
      generationConfig: { temperature: 0.7, maxOutputTokens: request.maxTokens || 4096 },
    });

    const prompt = buildPrompt(request);
    const result = await generativeModel.generateContentStream(prompt);

    let content = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) { content += text; onChunk(text); }
    }

    const response = await result.response;
    const usageMetadata = response.usageMetadata;

    return {
      content,
      confidence: 0.85,
      sources: [{ type: 'model', description: `Gemini (${model})` }],
      inputTokens: usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4),
      outputTokens: usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4),
      modelUsed: model,
      providerName: 'gemini',
    };
  },
};
