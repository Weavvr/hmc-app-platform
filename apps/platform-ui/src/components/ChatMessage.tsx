import { Bot, User } from 'lucide-react';
import type { SuggestedFeature } from '../lib/types';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  features?: SuggestedFeature[];
}

export default function ChatMessage({ role, content, features }: ChatMessageProps) {
  if (role === 'system') {
    return (
      <div className="flex justify-center py-3">
        <div className="max-w-lg text-center text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
          {content}
        </div>
      </div>
    );
  }

  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 py-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-gray-600" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>

        {/* Feature suggestions */}
        {features && features.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className={`text-xs font-medium ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
              Matched Features:
            </p>
            {features.map((f) => (
              <div key={f.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium ${isUser ? 'text-white' : 'text-gray-800'}`}>
                    {f.displayName || f.name}
                  </span>
                  <span className={`text-xs ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
                    {Math.round(f.confidence * 100)}%
                  </span>
                </div>
                {/* Confidence bar */}
                <div className={`w-full h-1.5 rounded-full ${isUser ? 'bg-blue-500' : 'bg-gray-200'}`}>
                  <div
                    className={`h-full rounded-full transition-all ${
                      isUser ? 'bg-white/70' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.round(f.confidence * 100)}%` }}
                  />
                </div>
                {f.reason && (
                  <p className={`text-xs ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
                    {f.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
