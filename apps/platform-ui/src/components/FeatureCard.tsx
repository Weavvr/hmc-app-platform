import { ChevronDown, ChevronUp, Package } from 'lucide-react';
import type { Feature } from '../lib/types';
import {
  TIER_LABELS,
  TIER_COLORS,
  COMPLEXITY_COLORS,
  STATUS_COLORS,
} from '../lib/types';
import FeatureDetail from './FeatureDetail';

interface FeatureCardProps {
  feature: Feature;
  selected?: boolean;
  onSelect?: (id: string) => void;
  expanded?: boolean;
  onToggleExpand?: (id: string) => void;
  allFeatures?: Feature[];
}

export default function FeatureCard({
  feature,
  selected = false,
  onSelect,
  expanded = false,
  onToggleExpand,
  allFeatures,
}: FeatureCardProps) {
  const tierLabel = TIER_LABELS[feature.tier] ?? `Tier ${feature.tier}`;
  const tierColor = TIER_COLORS[feature.tier] ?? 'bg-gray-100 text-gray-800';
  const complexityColor = COMPLEXITY_COLORS[feature.complexity] ?? 'bg-gray-100 text-gray-800';
  const statusColor = STATUS_COLORS[feature.status] ?? 'bg-gray-400';

  return (
    <div
      className={`rounded-lg border transition-all duration-150 ${
        selected
          ? 'border-blue-500 bg-blue-50/50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* Card header */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => onToggleExpand?.(feature.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelect(feature.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5 shrink-0"
              />
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {feature.displayName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} title={feature.status} />
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierColor}`}>
              T{feature.tier}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${complexityColor}`}>
              {feature.complexity}
            </span>
            {onToggleExpand && (
              expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )
            )}
          </div>
        </div>

        <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">
          {feature.description}
        </p>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {feature.package ? (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Package className="w-3 h-3" />
              {feature.package}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">Not extracted</span>
          )}

          {feature.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
          {feature.tags.length > 3 && (
            <span className="text-xs text-gray-400">
              +{feature.tags.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4">
          <FeatureDetail feature={feature} allFeatures={allFeatures} />
        </div>
      )}
    </div>
  );
}
