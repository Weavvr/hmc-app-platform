import { GitBranch, Settings, Tag, Package, FolderGit2 } from 'lucide-react';
import type { Feature } from '../lib/types';
import { TIER_LABELS } from '../lib/types';

interface FeatureDetailProps {
  feature: Feature;
  allFeatures?: Feature[];
}

export default function FeatureDetail({ feature, allFeatures }: FeatureDetailProps) {
  const featureLookup = new Map<string, Feature>();
  if (allFeatures) {
    allFeatures.forEach((f) => featureLookup.set(f.id, f));
  }

  return (
    <div className="pt-4 space-y-4">
      {/* Full description */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-1">Description</h4>
        <p className="text-sm text-gray-600">{feature.description}</p>
      </div>

      {/* Tier & complexity info */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Tier:</span>{' '}
          <span className="font-medium">
            {feature.tier} - {TIER_LABELS[feature.tier]}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Complexity:</span>{' '}
          <span className="font-medium">{feature.complexity}</span>
        </div>
        <div>
          <span className="text-gray-500">Category:</span>{' '}
          <span className="font-medium">{feature.category}</span>
        </div>
        <div>
          <span className="text-gray-500">Status:</span>{' '}
          <span className="font-medium capitalize">{feature.status}</span>
        </div>
      </div>

      {/* Package */}
      <div className="flex items-center gap-2 text-sm">
        <Package className="w-4 h-4 text-gray-400" />
        <span className="text-gray-500">Package:</span>
        {feature.package ? (
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
            {feature.package}
          </code>
        ) : (
          <span className="text-gray-400 italic">Not yet extracted</span>
        )}
      </div>

      {/* Dependencies */}
      {feature.dependencies.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <GitBranch className="w-4 h-4 text-gray-400" />
            <h4 className="text-sm font-medium text-gray-900">
              Dependencies ({feature.dependencies.length})
            </h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {feature.dependencies.map((depId) => {
              const dep = featureLookup.get(depId);
              return (
                <span
                  key={depId}
                  className="inline-flex items-center text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md"
                >
                  {dep ? dep.displayName : depId}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Config required */}
      {feature.configRequired.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <h4 className="text-sm font-medium text-gray-900">
              Configuration Required ({feature.configRequired.length})
            </h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {feature.configRequired.map((cfg) => (
              <code
                key={cfg}
                className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-mono"
              >
                {cfg}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Source repos */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <FolderGit2 className="w-4 h-4 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-900">Source Repositories</h4>
        </div>
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-gray-500">Best source:</span>{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
              {feature.bestSource}
            </code>
          </div>
          {feature.alsoIn.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-gray-500">Also in:</span>
              {feature.alsoIn.map((repo) => (
                <code
                  key={repo}
                  className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono"
                >
                  {repo}
                </code>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {feature.tags.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <h4 className="text-sm font-medium text-gray-900">Tags</h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {feature.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
