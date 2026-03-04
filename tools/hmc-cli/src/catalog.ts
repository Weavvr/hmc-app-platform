import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Feature definition matching the catalog/features.json structure.
 */
export interface Feature {
  id: string;
  name: string;
  displayName: string;
  description: string;
  tier: number;
  complexity: "S" | "M" | "L" | "XL";
  package: string | null;
  status: "extracted" | "planned" | "domain";
  bestSource: string;
  alsoIn: string[];
  dependencies: string[];
  configRequired: string[];
  tags: string[];
  category: string;
}

/**
 * Loads the feature catalog from catalog/features.json relative to the CLI package.
 */
export function loadCatalog(): Feature[] {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const catalogPath = resolve(__dirname, "..", "..", "..", "catalog", "features.json");
  const raw = readFileSync(catalogPath, "utf-8");
  return JSON.parse(raw) as Feature[];
}

/**
 * Search features by name, description, or tags.
 * Returns features where the query matches (case-insensitive) in any of those fields.
 */
export function searchFeatures(query: string, features: Feature[]): Feature[] {
  const q = query.toLowerCase();
  return features.filter((f) => {
    if (f.name.toLowerCase().includes(q)) return true;
    if (f.displayName.toLowerCase().includes(q)) return true;
    if (f.description.toLowerCase().includes(q)) return true;
    if (f.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  });
}

/**
 * Transitively resolve all dependencies for a set of selected feature IDs.
 * Returns the full set of IDs including all transitive dependencies.
 */
export function resolveDependencies(
  selectedIds: string[],
  features: Feature[]
): string[] {
  const featureMap = new Map<string, Feature>();
  for (const f of features) {
    featureMap.set(f.id, f);
  }

  const resolved = new Set<string>();
  const queue = [...selectedIds];

  while (queue.length > 0) {
    const id = queue.pop()!;
    if (resolved.has(id)) continue;
    resolved.add(id);

    const feature = featureMap.get(id);
    if (feature) {
      for (const depId of feature.dependencies) {
        if (!resolved.has(depId)) {
          queue.push(depId);
        }
      }
    }
  }

  return Array.from(resolved);
}

/**
 * Group features by their tier number.
 */
export function groupByTier(features: Feature[]): Map<number, Feature[]> {
  const groups = new Map<number, Feature[]>();
  for (const f of features) {
    const tier = f.tier;
    if (!groups.has(tier)) {
      groups.set(tier, []);
    }
    groups.get(tier)!.push(f);
  }
  return groups;
}

/**
 * Get a feature by its ID.
 */
export function getFeatureById(
  id: string,
  features: Feature[]
): Feature | undefined {
  return features.find((f) => f.id === id);
}

/**
 * Tier name mapping.
 */
export function tierName(tier: number): string {
  switch (tier) {
    case 1:
      return "Foundation";
    case 2:
      return "Shared Features";
    case 3:
      return "Domain Features";
    case 4:
      return "Enterprise & Compliance";
    default:
      return `Tier ${tier}`;
  }
}
