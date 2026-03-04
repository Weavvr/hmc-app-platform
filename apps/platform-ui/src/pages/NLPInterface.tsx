import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Check,
  Sparkles,
} from 'lucide-react';
import { analyzeDescription } from '../lib/api';
import type { ChatEntry, SuggestedFeature } from '../lib/types';
import ChatMessage from '../components/ChatMessage';

export default function NLPInterface() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ChatEntry[]>([
    {
      role: 'system',
      content:
        'Welcome to the AI Assistant! Describe the application you want to build, and I will suggest the right features from the HMC catalog. You can refine your request by saying things like "I also need..." or "I don\'t need...".',
    },
  ]);
  const [suggestedFeatures, setSuggestedFeatures] = useState<SuggestedFeature[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [apiError, setApiError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const mutation = useMutation({
    mutationFn: (message: string) =>
      analyzeDescription(
        message,
        history.filter((h) => h.role !== 'system'),
      ),
    onSuccess: (data, message) => {
      setApiError(null);

      // Add user message
      const userEntry: ChatEntry = { role: 'user', content: message };

      // Add assistant response with features
      const assistantEntry: ChatEntry = {
        role: 'assistant',
        content: data.message,
        features: data.features,
      };

      setHistory((prev) => [...prev, userEntry, assistantEntry]);

      // Update suggested features (merge with existing, update confidence)
      if (data.features && data.features.length > 0) {
        setSuggestedFeatures((prev) => {
          const map = new Map(prev.map((f) => [f.id, f]));
          data.features.forEach((f: SuggestedFeature) => map.set(f.id, f));
          return Array.from(map.values()).sort(
            (a, b) => b.confidence - a.confidence,
          );
        });

        // Auto-select new suggestions with confidence > 0.7
        setSelectedSuggestions((prev) => {
          const next = new Set(prev);
          data.features.forEach((f: SuggestedFeature) => {
            if (f.confidence >= 0.7) next.add(f.id);
          });
          return next;
        });
      }
    },
    onError: (err: Error) => {
      // Check for API key error
      if (
        err.message.includes('API') ||
        err.message.includes('key') ||
        err.message.includes('ANTHROPIC') ||
        err.message.includes('401') ||
        err.message.includes('403')
      ) {
        setApiError(
          'Configure ANTHROPIC_API_KEY to enable AI Assistant',
        );
      } else {
        setApiError(err.message);
      }

      // Still add user message to history
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: input },
      ]);
    },
  });

  const handleSend = useCallback(() => {
    const message = input.trim();
    if (!message || mutation.isPending) return;
    setInput('');
    mutation.mutate(message);
  }, [input, mutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleSuggestion = (id: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendToBuilder = () => {
    // Store selected features in sessionStorage for the builder to pick up
    const selected = suggestedFeatures.filter((f) =>
      selectedSuggestions.has(f.id),
    );
    sessionStorage.setItem(
      'nlp-selected-features',
      JSON.stringify(selected.map((f) => f.id)),
    );
    navigate('/builder');
  };

  return (
    <div className="flex h-full">
      {/* Left panel: Chat area */}
      <div className="flex-[2] flex flex-col border-r border-gray-200">
        {/* Chat messages */}
        <div className="flex-1 overflow-auto p-6 space-y-2">
          {history.map((entry, i) => (
            <ChatMessage
              key={i}
              role={entry.role}
              content={entry.content}
              features={entry.features}
            />
          ))}

          {mutation.isPending && (
            <div className="flex items-center gap-2 px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-500">Analyzing your description...</span>
            </div>
          )}

          {apiError && (
            <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg mx-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700">{apiError}</p>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the app you want to build..."
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || mutation.isPending}
              className={`p-2.5 rounded-lg transition-colors ${
                input.trim() && !mutation.isPending
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Try: "I need a patient portal with scheduling and billing" or "Build me a telehealth app"
          </p>
        </div>
      </div>

      {/* Right panel: Matched features */}
      <div className="flex-[1] overflow-auto p-6 bg-gray-50">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Matched Features</h3>
        </div>

        {suggestedFeatures.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">
              Describe your app in the chat and feature suggestions will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-6">
              {suggestedFeatures.map((f) => {
                const isSelected = selectedSuggestions.has(f.id);
                const confidencePercent = Math.round(f.confidence * 100);

                return (
                  <div
                    key={f.id}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleSuggestion(f.id)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {f.displayName || f.name}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto shrink-0">
                        {confidencePercent}%
                      </span>
                    </div>

                    {/* Confidence bar */}
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1">
                      <div
                        className={`h-full rounded-full transition-all ${
                          confidencePercent >= 80
                            ? 'bg-green-500'
                            : confidencePercent >= 60
                              ? 'bg-blue-500'
                              : confidencePercent >= 40
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                        }`}
                        style={{ width: `${confidencePercent}%` }}
                      />
                    </div>

                    {f.reason && (
                      <p className="text-xs text-gray-500 mt-1.5">{f.reason}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleSendToBuilder}
                disabled={selectedSuggestions.size === 0}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedSuggestions.size > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Send to App Builder
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-gray-400 text-center">
                {selectedSuggestions.size} of {suggestedFeatures.length} features selected
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
