import { Router } from 'express';
import {
  getAllFeatures,
  getFeatureById,
  getCatalogStats,
} from '../services/catalogService.js';
import { resolveDependencies } from '../services/dependencyResolver.js';

const router = Router();

/**
 * GET /api/catalog
 * Returns all features from the catalog.
 */
router.get('/', (_req, res) => {
  try {
    const features = getAllFeatures();
    res.json({ data: features });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/catalog/stats
 * Returns aggregate statistics about the catalog.
 */
router.get('/stats', (_req, res) => {
  try {
    const stats = getCatalogStats();
    res.json({ data: stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/catalog/:id
 * Returns a single feature by ID.
 */
router.get('/:id', (req, res) => {
  try {
    const feature = getFeatureById(req.params.id);
    if (!feature) {
      res.status(404).json({ error: `Feature "${req.params.id}" not found` });
      return;
    }
    res.json({ data: feature });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/catalog/:id/dependencies
 * Returns the resolved dependency tree for a feature.
 */
router.get('/:id/dependencies', (req, res) => {
  try {
    const feature = getFeatureById(req.params.id);
    if (!feature) {
      res.status(404).json({ error: `Feature "${req.params.id}" not found` });
      return;
    }

    const catalog = getAllFeatures();
    const result = resolveDependencies([req.params.id], catalog);
    res.json({ data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
