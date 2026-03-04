import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  X,
  CheckCircle2,
  Rocket,
  GitBranch,
} from 'lucide-react';
import { fetchFeatures, createRequest } from '../lib/api';
import type { Feature } from '../lib/types';
import { TIER_LABELS, STATUS_COLORS } from '../lib/types';

interface CategoryGroup {
  label: string;
  tier: number;
  features: Feature[];
}

export default function AppBuilder() {
  const navigate = useNavigate();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoResolvedIds, setAutoResolvedIds] = useState<Set<string>>(new Set());
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    data: features = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['features'],
    queryFn: fetchFeatures,
  });

  const featureMap = useMemo(() => {
    const m = new Map<string, Feature>();
    features.forEach((f) => m.set(f.id, f));
    return m;
  }, [features]);

  // Resolve dependencies recursively
  const resolveDependencies = useCallback(
    (featureId: string, visited: Set<string> = new Set()): string[] => {
      const feature = featureMap.get(featureId);
      if (!feature || visited.has(featureId)) return [];
      visited.add(featureId);

      const deps: string[] = [];
      for (const depId of feature.dependencies) {
        if (!visited.has(depId)) {
          deps.push(depId);
          deps.push(...resolveDependencies(depId, visited));
        }
      }
      return deps;
    },
    [featureMap],
  );

  const handleToggleFeature = useCallback(
    (featureId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const nextAuto = new Set(autoResolvedIds);

        if (next.has(featureId)) {
          // Uncheck: remove feature and any auto-resolved that are no longer needed
          next.delete(featureId);
          nextAuto.delete(featureId);

          // Recalculate auto-resolved based on remaining manually selected
          const manuallySelected = new Set<string>();
          next.forEach((id) => {
            if (!nextAuto.has(id)) manuallySelected.add(id);
          });

          const newAutoResolved = new Set<string>();
          manuallySelected.forEach((id) => {
            const deps = resolveDependencies(id);
            deps.forEach((depId) => {
              if (!manuallySelected.has(depId)) {
                newAutoResolved.add(depId);
              }
            });
          });

          // Remove features that were auto-resolved but no longer needed
          nextAuto.forEach((id) => {
            if (!newAutoResolved.has(id)) {
              next.delete(id);
            }
          });

          setAutoResolvedIds(newAutoResolved);
          // Re-add auto-resolved
          newAutoResolved.forEach((id) => next.add(id));
        } else {
          // Check: add feature and its dependencies
          next.add(featureId);
          const deps = resolveDependencies(featureId);
          deps.forEach((depId) => {
            if (!next.has(depId)) {
              next.add(depId);
              nextAuto.add(depId);
            }
          });
          setAutoResolvedIds(nextAuto);
        }

        return next;
      });
    },
    [resolveDependencies, autoResolvedIds],
  );

  const handleRemoveFeature = useCallback(
    (featureId: string) => {
      handleToggleFeature(featureId);
    },
    [handleToggleFeature],
  );

  // Group features by tier category
  const categories = useMemo((): CategoryGroup[] => {
    const groups: Record<number, Feature[]> = { 1: [], 2: [], 3: [], 4: [] };
    features.forEach((f) => {
      if (groups[f.tier]) groups[f.tier].push(f);
    });

    return [
      { label: 'Foundation', tier: 1, features: groups[1] },
      { label: 'Shared Features', tier: 2, features: groups[2] },
      { label: 'Domain Features', tier: 3, features: groups[3] },
      { label: 'Enterprise', tier: 4, features: groups[4] },
    ].filter((g) => g.features.length > 0);
  }, [features]);

  // Collect all configRequired from selected features
  const requiredConfigs = useMemo(() => {
    const configs = new Set<string>();
    selectedIds.forEach((id) => {
      const f = featureMap.get(id);
      if (f) {
        f.configRequired.forEach((c) => configs.add(c));
      }
    });
    return Array.from(configs);
  }, [selectedIds, featureMap]);

  const manualCount = selectedIds.size - autoResolvedIds.size;
  const autoCount = autoResolvedIds.size;

  const canGenerate = appName.trim().length > 0 && selectedIds.size > 0;

  const mutation = useMutation({
    mutationFn: () =>
      createRequest({
        name: appName.trim(),
        description: appDescription.trim(),
        selectedFeatures: Array.from(selectedIds),
        configuration: config,
        status: 'pending',
      }),
    onSuccess: () => {
      setShowSuccess(true);
    },
  });

  const toggleSection = (label: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading features...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">Failed to load features</p>
          <p className="text-sm text-gray-500 mt-1">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Request Created!</h3>
          <p className="text-gray-500 mb-6">
            Your app request "{appName}" has been submitted with {selectedIds.size} features.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/requests')}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Requests
            </button>
            <button
              onClick={() => {
                setShowSuccess(false);
                setSelectedIds(new Set());
                setAutoResolvedIds(new Set());
                setAppName('');
                setAppDescription('');
                setConfig({});
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Build Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left panel: Feature checklist */}
      <div className="flex-[2] border-r border-gray-200 overflow-auto p-6">
        {/* Dependency count */}
        <div className="mb-4 text-sm text-gray-600">
          <span className="font-medium text-gray-900">{selectedIds.size}</span> features selected
          {autoCount > 0 && (
            <span className="text-gray-500">
              {' '}({autoCount} auto-resolved {autoCount === 1 ? 'dependency' : 'dependencies'})
            </span>
          )}
        </div>

        {/* Categories */}
        <div className="space-y-2">
          {categories.map((cat) => {
            const isCollapsed = collapsedSections.has(cat.label);
            const selectedInGroup = cat.features.filter((f) =>
              selectedIds.has(f.id),
            ).length;

            return (
              <div key={cat.label} className="border border-gray-200 rounded-lg">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(cat.label)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="font-medium text-gray-900">{cat.label}</span>
                    <span className="text-xs text-gray-400">
                      ({cat.features.length} features)
                    </span>
                  </div>
                  {selectedInGroup > 0 && (
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {selectedInGroup} selected
                    </span>
                  )}
                </button>

                {/* Feature list */}
                {!isCollapsed && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {cat.features.map((feature) => {
                      const isSelected = selectedIds.has(feature.id);
                      const isAutoResolved = autoResolvedIds.has(feature.id);
                      const statusColor = STATUS_COLORS[feature.status] ?? 'bg-gray-400';

                      return (
                        <label
                          key={feature.id}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                            isSelected ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleFeature(feature.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {feature.displayName}
                              </span>
                              {isAutoResolved && (
                                <span className="text-xs text-blue-500 italic shrink-0 flex items-center gap-1">
                                  <GitBranch className="w-3 h-3" />
                                  auto-selected
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                              {feature.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: Configuration */}
      <div className="flex-[1] overflow-auto p-6 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">App Configuration</h3>

        <div className="space-y-4">
          {/* App name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              App Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="my-hmc-app"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={appDescription}
              onChange={(e) => setAppDescription(e.target.value)}
              placeholder="Describe what this app does..."
              rows={3}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Selected features summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selected Features ({selectedIds.size})
            </label>
            {selectedIds.size === 0 ? (
              <p className="text-sm text-gray-400 italic">No features selected yet</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-auto">
                {Array.from(selectedIds).map((id) => {
                  const f = featureMap.get(id);
                  if (!f) return null;
                  const isAuto = autoResolvedIds.has(id);
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded px-2.5 py-1.5 text-sm"
                    >
                      <span className={`truncate ${isAuto ? 'text-gray-400' : 'text-gray-700'}`}>
                        {f.displayName}
                        {isAuto && (
                          <span className="text-xs text-blue-400 ml-1">(dep)</span>
                        )}
                      </span>
                      <button
                        onClick={() => handleRemoveFeature(id)}
                        className="text-gray-400 hover:text-red-500 shrink-0 ml-2"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Required configuration */}
          {requiredConfigs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Required Configuration
              </label>
              <div className="space-y-2">
                {requiredConfigs.map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-mono text-gray-500 mb-0.5">
                      {key}
                    </label>
                    <input
                      type="text"
                      value={config[key] || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={`Enter ${key}...`}
                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={() => mutation.mutate()}
            disabled={!canGenerate || mutation.isPending}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              canGenerate && !mutation.isPending
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            {mutation.isPending ? 'Creating Request...' : 'Create App Request'}
          </button>

          {mutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Failed to create request'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
