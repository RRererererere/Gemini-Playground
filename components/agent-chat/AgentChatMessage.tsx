'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { AgentChatMessage, AgentChatConfig } from '@/lib/agent-engine/chat-types';
import { AgentStepsList } from './AgentStepsList';
import { User } from 'lucide-react';

interface AgentChatMessageComponentProps {
  message: AgentChatMessage;
  agentConfig: AgentChatConfig;
}

export function AgentChatMessageComponent({ message, agentConfig }: AgentChatMessageComponentProps) {
  const [stepsExpanded, setStepsExpanded] = useState(message.status === 'streaming');

  if (message.role === 'user') {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[80%]">
          <div className="whitespace-pre-wrap break-words">{message.userText}</div>
        </div>
        <div className="w-8 h-8 rounded-full bg-[var(--surface-3)] flex items-center justify-center flex-shrink-0">
          <User size={16} className="text-[var(--text-dim)]" />
        </div>
      </div>
    );
  }

  // Agent message
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: agentConfig.avatarColor }}
      >
        {agentConfig.avatarEmoji}
      </div>

      <div className="flex-1 min-w-0">
        {/* Steps */}
        {message.steps.length > 0 && (
          <AgentStepsList
            steps={message.steps}
            expanded={stepsExpanded}
            onToggle={() => setStepsExpanded(!stepsExpanded)}
            isStreaming={message.status === 'streaming'}
          />
        )}

        {/* Final Answer */}
        {message.content && message.status !== 'streaming' && (
          <div className="mt-3 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  return inline ? (
                    <code className="bg-[var(--surface-3)] px-1.5 py-0.5 rounded text-sm" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Streaming indicator */}
        {message.status === 'streaming' && !message.content && (
          <div className="mt-3 flex items-center gap-2 text-[var(--text-dim)]">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm">Агент думает...</span>
          </div>
        )}

        {/* Error */}
        {message.status === 'error' && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
            <div className="text-red-400 text-sm">{message.content || 'Произошла ошибка'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
