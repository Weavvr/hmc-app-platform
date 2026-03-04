import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AppRequest, AppRequestStatus } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.resolve(__dirname, '../../requests.json');

const router = Router();

// ── In-Memory Store ─────────────────────────────────────────────

let requests: AppRequest[] = loadFromDisk();

function loadFromDisk(): AppRequest[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(raw) as AppRequest[];
    }
  } catch {
    console.warn('Failed to load requests from disk, starting fresh');
  }
  return [];
}

function saveToDisk(): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(requests, null, 2), 'utf-8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to persist requests: ${message}`);
  }
}

// ── Routes ──────────────────────────────────────────────────────

/**
 * GET /api/requests
 * Returns all app requests.
 */
router.get('/', (_req, res) => {
  res.json({ data: requests });
});

/**
 * POST /api/requests
 * Creates a new app request.
 *
 * Body: {
 *   name: string,
 *   description: string,
 *   selectedFeatures: string[],
 *   configuration?: Record<string, string>,
 *   nlpConversation?: Array<{ role: string, content: string }>
 * }
 */
router.post('/', (req, res) => {
  try {
    const {
      name,
      description,
      selectedFeatures,
      configuration,
      nlpConversation,
    } = req.body as {
      name?: string;
      description?: string;
      selectedFeatures?: string[];
      configuration?: Record<string, string>;
      nlpConversation?: Array<{ role: string; content: string }>;
    };

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "name" field' });
      return;
    }
    if (!description || typeof description !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "description" field' });
      return;
    }
    if (!Array.isArray(selectedFeatures)) {
      res
        .status(400)
        .json({ error: '"selectedFeatures" must be an array of feature IDs' });
      return;
    }

    const now = new Date().toISOString();
    const appRequest: AppRequest = {
      id: crypto.randomUUID(),
      name,
      description,
      selectedFeatures,
      configuration: configuration ?? {},
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      nlpConversation,
    };

    requests.push(appRequest);
    saveToDisk();

    res.status(201).json({ data: appRequest });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/requests/:id
 * Updates an existing app request's status (and optionally repoUrl).
 *
 * Body: {
 *   status?: AppRequestStatus,
 *   repoUrl?: string,
 *   selectedFeatures?: string[],
 *   configuration?: Record<string, string>,
 *   nlpConversation?: Array<{ role: string, content: string }>
 * }
 */
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const index = requests.findIndex((r) => r.id === id);

    if (index === -1) {
      res.status(404).json({ error: `Request "${id}" not found` });
      return;
    }

    const updates = req.body as {
      status?: AppRequestStatus;
      repoUrl?: string;
      selectedFeatures?: string[];
      configuration?: Record<string, string>;
      nlpConversation?: Array<{ role: string; content: string }>;
    };

    const validStatuses: AppRequestStatus[] = [
      'pending',
      'approved',
      'generating',
      'complete',
      'failed',
    ];
    if (updates.status && !validStatuses.includes(updates.status)) {
      res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const existing = requests[index];
    requests[index] = {
      ...existing,
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.repoUrl !== undefined && { repoUrl: updates.repoUrl }),
      ...(updates.selectedFeatures !== undefined && {
        selectedFeatures: updates.selectedFeatures,
      }),
      ...(updates.configuration !== undefined && {
        configuration: updates.configuration,
      }),
      ...(updates.nlpConversation !== undefined && {
        nlpConversation: updates.nlpConversation,
      }),
      updatedAt: new Date().toISOString(),
    };

    saveToDisk();

    res.json({ data: requests[index] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/requests/:id
 * Removes an app request.
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const index = requests.findIndex((r) => r.id === id);

    if (index === -1) {
      res.status(404).json({ error: `Request "${id}" not found` });
      return;
    }

    requests.splice(index, 1);
    saveToDisk();

    res.json({ data: { deleted: true, id } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
