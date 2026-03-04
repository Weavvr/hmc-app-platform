import type { Feature, DependencyNode } from '../types.js';

interface ResolveResult {
  resolved: string[];
  tree: DependencyNode[];
}

/**
 * Resolves all transitive dependencies for a set of selected feature IDs.
 *
 * @param featureIds - The user-selected feature IDs
 * @param catalog - The full feature catalog
 * @returns The complete set of resolved feature IDs and a dependency tree
 * @throws If a circular dependency is detected or a dependency is not found
 */
export function resolveDependencies(
  featureIds: string[],
  catalog: Feature[]
): ResolveResult {
  const featureMap = new Map<string, Feature>();
  for (const f of catalog) {
    featureMap.set(f.id, f);
  }

  // Validate all requested features exist
  for (const id of featureIds) {
    if (!featureMap.has(id)) {
      throw new Error(`Feature "${id}" not found in catalog`);
    }
  }

  const resolved = new Set<string>();
  const tree: DependencyNode[] = [];

  for (const id of featureIds) {
    const node = resolveOne(id, featureMap, resolved, new Set<string>());
    tree.push(node);
  }

  return {
    resolved: Array.from(resolved),
    tree,
  };
}

/**
 * Recursively resolves a single feature and its transitive dependencies.
 */
function resolveOne(
  featureId: string,
  featureMap: Map<string, Feature>,
  resolved: Set<string>,
  visiting: Set<string>
): DependencyNode {
  const feature = featureMap.get(featureId);
  if (!feature) {
    throw new Error(`Dependency "${featureId}" not found in catalog`);
  }

  if (visiting.has(featureId)) {
    const chain = Array.from(visiting).join(' -> ');
    throw new Error(
      `Circular dependency detected: ${chain} -> ${featureId}`
    );
  }

  visiting.add(featureId);

  const children: DependencyNode[] = [];

  for (const depId of feature.dependencies) {
    if (!resolved.has(depId)) {
      const childNode = resolveOne(depId, featureMap, resolved, new Set(visiting));
      children.push(childNode);
    }
  }

  resolved.add(featureId);

  return {
    id: feature.id,
    name: feature.name,
    displayName: feature.displayName,
    children,
  };
}
