import Anthropic from '@anthropic-ai/sdk';
import type { Feature, NLPResult } from '../types.js';

/**
 * Analyzes a user's natural-language description of their desired app
 * and maps it to features from the catalog using Claude.
 */
export async function analyzeDescription(
  message: string,
  features: Feature[],
  history?: Array<{ role: string; content: string }>
): Promise<NLPResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is not set. Cannot perform NLP analysis.'
    );
  }

  const client = new Anthropic({ apiKey });

  const featureSummary = features
    .map(
      (f) =>
        `- ${f.id}: ${f.displayName} — ${f.description} [tier:${f.tier}, tags:${f.tags.join(',')}]`
    )
    .join('\n');

  const systemPrompt = `You are a feature-mapping assistant for the HMC App Platform.

Your job is to analyze a user's description of the application they want to build and map their requirements to features from our catalog.

Here is the complete feature catalog:

${featureSummary}

When the user describes their app, identify which features from the catalog would be needed. Consider both explicitly mentioned requirements and implied ones (e.g., if they mention "users can log in," that implies authentication).

You MUST respond with valid JSON in this exact format:
{
  "response": "A friendly, human-readable summary of what you understood and what features you recommend",
  "suggestedFeatures": ["feature-id-1", "feature-id-2"],
  "confidence": {
    "feature-id-1": 0.95,
    "feature-id-2": 0.7
  }
}

Rules:
- Only suggest features that exist in the catalog (use exact IDs).
- Assign a confidence score between 0 and 1 for each suggested feature.
- High confidence (0.8-1.0) = the user explicitly or clearly needs this.
- Medium confidence (0.5-0.79) = the user likely needs this based on context.
- Low confidence (0.3-0.49) = might be useful but not certain.
- Do not suggest features with confidence below 0.3.
- Your response field should be conversational and helpful.
- If the description is vague, ask clarifying questions in the response field while still suggesting likely features.`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (history && history.length > 0) {
    for (const msg of history) {
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      messages.push({ role, content: msg.content });
    }
  }

  messages.push({ role: 'user', content: message });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  // Extract text content from the response
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  const rawText = textBlock.text;

  // Try to parse the JSON from the response
  // Claude might wrap it in markdown code fences
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // If Claude didn't return JSON, build a fallback result
    return {
      response: rawText,
      suggestedFeatures: [],
      confidence: {},
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as NLPResult;
    return {
      response: parsed.response ?? rawText,
      suggestedFeatures: parsed.suggestedFeatures ?? [],
      confidence: parsed.confidence ?? {},
    };
  } catch {
    return {
      response: rawText,
      suggestedFeatures: [],
      confidence: {},
    };
  }
}
