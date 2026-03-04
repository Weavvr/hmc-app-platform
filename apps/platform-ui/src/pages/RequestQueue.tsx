import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  PlayCircle,
  CheckCircle,
  ExternalLink,
  Clock,
  Inbox,
} from 'lucide-react';
import { fetchRequests, updateRequest } from '../lib/api';
import type { AppRequest } from '../lib/types';
import { REQUEST_STATUS_STYLES } from '../lib/types';

export default function RequestQueue() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: requests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['requests'],
    queryFn: fetchRequests,
    refetchInterval: 5000, // Poll for status updates
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => updateRequest(id, { status: 'approved' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => updateRequest(id, { status: 'generating' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => updateRequest(id, { status: 'failed' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  });

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading requests...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">Failed to load requests</p>
          <p className="text-sm text-gray-500 mt-1">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No requests yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Use the App Builder or AI Assistant to create your first app request.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_120px_140px_140px] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div>Name</div>
          <div>Features</div>
          <div>Status</div>
          <div>Created</div>
          <div>Actions</div>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-gray-100">
          {requests.map((req: AppRequest) => {
            const isExpanded = expandedId === req.id;
            const statusStyle =
              REQUEST_STATUS_STYLES[req.status] ?? 'bg-gray-100 text-gray-800';

            return (
              <div key={req.id}>
                {/* Row */}
                <div
                  className="grid grid-cols-[1fr_100px_120px_140px_140px] gap-4 px-4 py-3 items-center hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : req.id)
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {req.name}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600">
                    {req.selectedFeatures.length} features
                  </div>

                  <div>
                    <span
                      className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${statusStyle}`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(req.createdAt)}
                  </div>

                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {req.status === 'pending' && (
                      <button
                        onClick={() => approveMutation.mutate(req.id)}
                        disabled={approveMutation.isPending}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                        title="Approve"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}

                    {req.status === 'approved' && (
                      <button
                        onClick={() => generateMutation.mutate(req.id)}
                        disabled={generateMutation.isPending}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Generate"
                      >
                        <PlayCircle className="w-4 h-4" />
                      </button>
                    )}

                    {req.repoUrl && (
                      <a
                        href={req.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        title="Open repository"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}

                    {(req.status === 'pending' || req.status === 'failed') && (
                      <button
                        onClick={() => deleteMutation.mutate(req.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-10 pb-4 pt-1 bg-gray-50/50 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Description */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Description
                        </h4>
                        <p className="text-sm text-gray-700">
                          {req.description || 'No description provided'}
                        </p>
                      </div>

                      {/* Selected Features */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Selected Features
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {req.selectedFeatures.map((fId) => (
                            <span
                              key={fId}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                            >
                              {fId}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Configuration */}
                      {req.configuration &&
                        Object.keys(req.configuration).length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                              Configuration
                            </h4>
                            <div className="space-y-1">
                              {Object.entries(req.configuration).map(
                                ([key, value]) => (
                                  <div key={key} className="text-sm">
                                    <code className="text-xs text-gray-500 font-mono">
                                      {key}:
                                    </code>{' '}
                                    <span className="text-gray-700">{value}</span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Repo URL */}
                      {req.repoUrl && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Repository
                          </h4>
                          <a
                            href={req.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {req.repoUrl}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
