import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { fetchFeatures } from '../lib/api';
import type { Feature } from '../lib/types';
import { TIER_LABELS, STATUS_COLORS } from '../lib/types';
import FeatureCard from '../components/FeatureCard';

type TierFilter = 'all' | 1 | 2 | 3 | 4;
type StatusFilter = 'all' | 'extracted' | 'planned' | 'domain';

export default function FeatureBrowser() {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: features = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['features'],
    queryFn: fetchFeatures,
  });

  const filtered = useMemo(() => {
    let result = features;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (f: Feature) =>
          f.name.toLowerCase().includes(q) ||
          f.displayName.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.tags.some((t: string) => t.toLowerCase().includes(q)),
      );
    }

    if (tierFilter !== 'all') {
      result = result.filter((f: Feature) => f.tier === tierFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((f: Feature) => f.status === statusFilter);
    }

    return result;
  }, [features, search, tierFilter, statusFilter]);

  const extractedCount = filtered.filter((f) => f.status === 'extracted').length;
  const plannedCount = filtered.filter((f) => f.status === 'planned').length;

  const tierTabs: { value: TierFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 1, label: 'Foundation (T1)' },
    { value: 2, label: 'Shared (T2)' },
    { value: 3, label: 'Domain (T3)' },
    { value: 4, label: 'Enterprise (T4)' },
  ];

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'extracted', label: 'Extracted' },
    { value: 'planned', label: 'Planned' },
    { value: 'domain', label: 'Domain' },
  ];

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

  return (
    <div className="p-6 space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search features by name, description, or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Tier tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tierTabs.map((tab) => (
            <button
              key={String(tab.value)}
              onClick={() => setTierFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tierFilter === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.value !== 'all' && (
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[tab.value]}`} />
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>
          <strong className="text-gray-900">{filtered.length}</strong> features shown
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {extractedCount} extracted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          {plannedCount} planned
        </span>
      </div>

      {/* Feature grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">No features found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              expanded={expandedId === feature.id}
              onToggleExpand={(id) =>
                setExpandedId(expandedId === id ? null : id)
              }
              allFeatures={features}
            />
          ))}
        </div>
      )}
    </div>
  );
}
