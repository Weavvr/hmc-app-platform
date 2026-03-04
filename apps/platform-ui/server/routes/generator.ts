import { Router } from 'express';
import {
  getAllFeatures,
  getFeatureById,
} from '../services/catalogService.js';
import { resolveDependencies } from '../services/dependencyResolver.js';
import { generateRepo } from '../services/repoGenerator.js';
import type { GenerateOptions } from '../types.js';

const router = Router();

/**
 * POST /api/generate
 * Generates a new GitHub repository scaffolded with selected HMC features.
 *
 * Body: { name: string, description: string, features: string[], config: Record<string, string> }
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, features, config } = req.body as GenerateOptions;

    // Validate required fields
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "name" field' });
      return;
    }
    if (!description || typeof description !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "description" field' });
      return;
    }
    if (!Array.isArray(features) || features.length === 0) {
      res
        .status(400)
        .json({ error: '"features" must be a non-empty array of feature IDs' });
      return;
    }

    // Validate all feature IDs exist
    const missing: string[] = [];
    for (const id of features) {
      if (!getFeatureById(id)) {
        missing.push(id);
      }
    }
    if (missing.length > 0) {
      res.status(400).json({
        error: `Unknown feature IDs: ${missing.join(', ')}`,
      });
      return;
    }

    // Resolve dependencies
    const catalog = getAllFeatures();
    const { resolved } = resolveDependencies(features, catalog);

    // Gather full feature objects for resolved set
    const resolvedFeatures = resolved
      .map((id) => getFeatureById(id))
      .filter((f): f is NonNullable<typeof f> => f !== undefined);

    // Generate the repo
    const result = await generateRepo(
      { name, description, features: resolved, config: config ?? {} },
      resolvedFeatures
    );

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({ data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
