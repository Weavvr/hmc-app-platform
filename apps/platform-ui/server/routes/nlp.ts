import { Router } from 'express';
import { getAllFeatures } from '../services/catalogService.js';
import { analyzeDescription } from '../services/nlpService.js';

const router = Router();

/**
 * POST /api/nlp/analyze
 * Sends a user's app description to Claude for feature mapping.
 *
 * Body: {
 *   message: string,
 *   conversationHistory?: Array<{ role: string, content: string }>
 * }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body as {
      message?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    };

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "message" field' });
      return;
    }

    const features = getAllFeatures();
    const result = await analyzeDescription(
      message,
      features,
      conversationHistory
    );

    res.json({ data: result });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);

    // Surface missing API key as a clear 500
    if (message.includes('ANTHROPIC_API_KEY')) {
      res.status(500).json({ error: message });
      return;
    }

    res.status(500).json({ error: `NLP analysis failed: ${message}` });
  }
});

export default router;
