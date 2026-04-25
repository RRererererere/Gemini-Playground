'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { AgentChatMessage, AgentChatConfig } from '@/lib/agent-engine/chat-types';
import { User, Loader2, CheckCircle2, MessageCircle, ChevronDown } from 'lucide-react';

interface AgentChatMessageComponentProps {
  message: AgentChatMessage;
  agentConfig: AgentChatConfig;
}

export function AgentChatMessageComponent({ message, agentConfig }: AgentChatMessageComponentProps) {
  const isUser = message.role === 'user';
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  
  const toggleStep = (nodeId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };
  
  return (
    <div className={`group relative animate-fade-in ${isUser ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 mb-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-[var(--surface-4)] border border-[var(--border-strong)]'
            : 'border border-[var(--border-strong)] shadow-sm'
        }`}
        style={!isUser ? { backgroundColor: agentConfig.avatarColor } : undefined}
        >
          {isUser
            ? <User size={10} className="text-[var(--text-muted)]" />
            : <span className="text-[10px]">{agentConfig.avatarEmoji}</span>
          }
        </div>
        <span className="text-[10px] font-medium text-[var(--text-dim)] uppercase tracking-widest">
          {isUser ? 'Вы' : agentConfig.name}
        </span>
      </div>

      {/* Message Bubble */}
      {/* 🔴 ФИКС #8: Пузырь пользователя с визуальным отличием */}
      <div className={`relative w-full ${isUser ? 'max-w-[90%] md:max-w-[75%] self-end' : 'w-full self-start'}`}>
        <div
          className={`rounded-xl text-sm leading-relaxed ${
            isUser
              ? 'bg-indigo-500/12 border border-indigo-500/20 px-4 py-3 text-[var(--text-primary)] rounded-[18px_18px_4px_18px] shadow-sm'
              : 'text-[var(--text-primary)]'
          }`}
        >
          {/* Agent Steps / Trace - Компактный стиль как на картинке */}
          {!isUser && message.steps && message.steps.length > 0 && (
            <div className="mb-6 space-y-1">
              {message.steps.map(step => {
                const isExpanded = expandedSteps.has(step.nodeId);
                const hasDetails = step.status === 'done' && step.content && typeof step.content === 'object';
                
                return (
                  <div key={step.nodeId} className="group">
                    {/* Заголовок шага */}
                    <div 
                      className={`flex items-center gap-2 py-1 ${hasDetails ? 'cursor-pointer hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-colors' : ''}`}
                      onClick={() => hasDetails && toggleStep(step.nodeId)}
                    >
                      {/* Иконка статуса */}
                      <div className="flex-shrink-0">
                        {step.status === 'running' ? (
                          <div className="flex items-center justify-center w-4 h-4">
                            <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          </div>
                        ) : step.status === 'error' ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                        )}
                      </div>
                      
                      {/* Название шага */}
                      <span className={`text-[13px] ${step.status === 'running' ? 'text-white/90' : 'text-white/40'}`}>
                        {step.nodeLabel}
                      </span>
                      
                      {/* Длительность */}
                      {step.status === 'done' && step.duration && (
                        <span className="text-[11px] text-white/20 ml-auto">
                          {step.duration}ms
                        </span>
                      )}
                      
                      {/* Иконка раскрытия */}
                      {hasDetails && (
                        <ChevronDown 
                          size={12} 
                          className={`text-white/20 transition-transform ml-1 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      )}
                    </div>
                    
                    {/* Раскрываемые детали */}
                    {isExpanded && hasDetails && typeof step.content === 'object' && (
                      <div className="mt-2 ml-6 animate-in fade-in slide-in-from-top-1">
                        <div className="bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-2 font-semibold">
                            Данные шага
                          </div>
                          <pre className="text-xs text-[var(--text-secondary)] font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">
                            {JSON.stringify(step.content, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    
                    {/* Результат фидбека */}
                    {step.type === 'feedback_request' && step.status === 'done' && step.content && typeof step.content === 'object' && (
                      <div className="mt-1 ml-6 flex items-center gap-2 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 w-fit text-[11px] text-white/70">
                        <MessageCircle size={11} className="text-[var(--text-muted)]" />
                        {(step.content as any).feedback_result?.reaction === 'like' ? '👍 Принято' : (step.content as any).feedback_result?.reaction === 'dislike' ? '👎 Отклонено' : '⏭ Пропущено'}
                        {(step.content as any).feedback_result?.comment && `: "${(step.content as any).feedback_result.comment}"`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Final Message Content */}
          <div className={`prose prose-invert max-w-none text-[15px] leading-relaxed text-[#e0e0e0] ${!isUser && message.status === 'streaming' ? 'streaming-cursor' : ''}`}>
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">{message.userText || message.content}</p>
            ) : (
              message.content && typeof message.content === 'string' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      return inline ? (
                        <code className="bg-[var(--surface-3)] px-1.5 py-0.5 rounded text-sm font-mono text-[var(--text-primary)] border border-white/5" {...props}>
                          {children}
                        </code>
                      ) : (
                        <div className="relative group">
                          <pre className="overflow-x-auto p-4 rounded-xl bg-[#0a0a0a] border border-[var(--border-subtle)] font-mono text-sm leading-relaxed my-4 shadow-xl">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : null
            )}
          </div>
          
          {/* Fallback streaming text */}
          {!isUser && message.status === 'streaming' && !message.content && (
            <div className="mt-4 flex items-center gap-2 text-white/50 text-[11px] uppercase tracking-[0.2em] font-mono">
              <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
              <span>Генерация...</span>
            </div>
          )}

          {/* Error */}
          {!isUser && message.status === 'error' && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 shadow-inner">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Ошибка выполнения</span>
              </div>
              <div className="text-red-400/90 text-sm leading-relaxed">{message.content || 'Произошла непредвиденная ошибка в графе'}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
