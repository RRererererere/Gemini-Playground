'use client';

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, SkipForward } from 'lucide-react';
import { FeedbackRequest, FeedbackResponse } from '@/lib/agent-engine/chat-types';

interface InlineFeedbackWidgetProps {
  request: FeedbackRequest;
  onResponse: (response: FeedbackResponse) => void;
}

export function InlineFeedbackWidget({ request, onResponse }: InlineFeedbackWidgetProps) {
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsStreaming] = useState(false);

  const handleSubmit = (reaction: 'like' | 'dislike' | 'skip') => {
    setIsStreaming(true);
    onResponse({ reaction, comment, timestamp: Date.now() });
  };

  if (isSubmitted) return null;

  return (
    <div className="flex flex-col gap-4 py-6 animate-in fade-in slide-in-from-bottom-2 ml-1">
      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-semibold text-white uppercase tracking-[0.2em] opacity-80">
          {request.promptText}
        </p>
        
        {request.showContent && request.context && (
          <div className="text-xs bg-[#0a0a0a] rounded-xl p-4 font-mono text-white/50 overflow-x-auto border border-white/5 max-h-40 overflow-y-auto">
            {typeof request.context === 'string' ? request.context : JSON.stringify(request.context, null, 2)}
          </div>
        )}
      </div>

      {request.allowComment && (
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={request.commentPlaceholder || 'Введите ваше уточнение...'}
          className="w-full bg-transparent border-b border-white/10 px-0 py-2 text-[15px] text-white focus:outline-none focus:border-white transition-all placeholder:text-white/20"
          autoFocus
        />
      )}

      <div className="flex flex-wrap gap-3 mt-2">
        <button
          onClick={() => handleSubmit('like')}
          className="px-6 py-2.5 bg-white hover:bg-gray-200 text-black rounded-full text-[13px] font-bold transition-all flex items-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95"
        >
          <ThumbsUp size={14} className="fill-current" />
          ПРИНЯТЬ
        </button>

        <button
          onClick={() => handleSubmit('dislike')}
          className="px-6 py-2.5 bg-white hover:bg-gray-200 text-black rounded-full text-[13px] font-bold transition-all flex items-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95"
        >
          <ThumbsDown size={14} className="fill-current" />
          ОТКЛОНИТЬ
        </button>

        <button
          onClick={() => handleSubmit('skip')}
          className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full text-[12px] font-medium transition-all flex items-center gap-2 border border-white/5 ml-auto"
        >
          <SkipForward size={14} />
          ПРОПУСТИТЬ
        </button>
      </div>
    </div>
  );
}
