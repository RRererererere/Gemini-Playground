import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Send, X, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FeedbackModalProps {
  promptText: string;
  context: any;
  onSubmit: (feedback: { reaction: 'like' | 'dislike' | 'none'; message: string; context: any }) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ promptText, context, onSubmit }) => {
  const [reaction, setReaction] = useState<'like' | 'dislike' | 'none'>('none');
  const [message, setMessage] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[var(--surface-1)] border border-[var(--border-strong)] rounded-2xl w-full max-w-[550px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <MessageSquare size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">{promptText}</h2>
              <p className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider font-semibold">Human in the loop</p>
            </div>
          </div>
          <button 
            onClick={() => onSubmit({ reaction: 'none', message: '', context })}
            className="p-2 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-dim)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Context Viewer */}
          {context && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest ml-1">
                <Info size={12} className="text-indigo-400" />
                Input Context
              </div>
              <div className="text-sm text-[var(--text-primary)] bg-[var(--surface-3)] p-4 rounded-xl border border-[var(--border)] max-h-48 overflow-y-auto shadow-inner prose prose-invert prose-sm max-w-none">
                {typeof context === 'object' ? (
                  <pre className="font-mono text-xs">{JSON.stringify(context, null, 2)}</pre>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {String(context)}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          )}

          {/* Reaction Buttons */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest ml-1">Your Reaction</div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setReaction('like')}
                className={`group p-5 rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 border-2 ${
                  reaction === 'like' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]' 
                    : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-3)]'
                }`}
              >
                <div className={`p-2 rounded-lg transition-colors ${reaction === 'like' ? 'bg-emerald-500/20' : 'bg-[var(--surface-1)]'}`}>
                  <ThumbsUp size={24} className={reaction === 'like' ? 'fill-emerald-400' : 'group-hover:text-emerald-400'} />
                </div>
                <span className="text-sm font-bold">Approve</span>
              </button>
              
              <button
                onClick={() => setReaction('dislike')}
                className={`group p-5 rounded-2xl flex items-center justify-center gap-3 transition-all duration-200 border-2 ${
                  reaction === 'dislike' 
                    ? 'bg-red-500/10 text-red-500 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' 
                    : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-3)]'
                }`}
              >
                <div className={`p-2 rounded-lg transition-colors ${reaction === 'dislike' ? 'bg-red-500/20' : 'bg-[var(--surface-1)]'}`}>
                  <ThumbsDown size={24} className={reaction === 'dislike' ? 'fill-red-500' : 'group-hover:text-red-500'} />
                </div>
                <span className="text-sm font-bold">Reject</span>
              </button>
            </div>
          </div>

          {/* Comment Area */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest ml-1">Comments</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain your decision (optional)..."
              className="w-full h-28 bg-[var(--surface-3)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-[var(--text-dim)]/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center justify-between">
          <p className="text-[10px] text-[var(--text-dim)] italic">
            This response will resume the execution flow.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => onSubmit({ reaction: 'none', message: '', context })}
              className="px-5 py-2.5 text-sm font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors rounded-xl"
            >
              Skip
            </button>
            <button
              onClick={() => onSubmit({ reaction, message, context })}
              disabled={reaction === 'none'}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg ${
                reaction === 'none'
                  ? 'bg-[var(--surface-3)] text-[var(--text-dim)] cursor-not-allowed grayscale'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 hover:scale-105 active:scale-95'
              }`}
            >
              <Send size={16} />
              Continue Flow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
