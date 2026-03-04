export type LLMProviderName = 'anthropic' | 'openai' | 'gemini' | 'perplexity' | 'grok' | 'cohere' | 'mistral';

export interface LLMProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  thinkingMode?: {
    enabled: boolean;
    budgetTokens?: number;
    modelOverride?: string;
  };
}

export interface FileAttachment {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  base64Data?: string;
  textContent?: string;
  category: 'image' | 'document' | 'audio';
}

export interface GatewayQueryRequest {
  query: string;
  systemPrompt: string;
  contextData?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  maxTokens?: number;
  attachments?: FileAttachment[];
}

export interface GatewayQueryResponse {
  content: string;
  confidence: number;
  sources: Array<{
    type: 'model' | 'context' | 'web';
    description: string;
    url?: string;
  }>;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  modelUsed: string;
  providerName: LLMProviderName;
}

export interface LLMProvider {
  name: LLMProviderName;
  query(request: GatewayQueryRequest, config: LLMProviderConfig): Promise<GatewayQueryResponse>;
  streamQuery?(
    request: GatewayQueryRequest,
    config: LLMProviderConfig,
    onChunk: (text: string) => void
  ): Promise<GatewayQueryResponse>;
}
