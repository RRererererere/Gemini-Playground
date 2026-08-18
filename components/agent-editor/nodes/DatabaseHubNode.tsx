import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { NodeProps } from '@xyflow/react';
import { 
  Database, Plus, Trash2, ArrowUp, ArrowDown, Edit3, Check, X,
  User, Cpu, Settings as SettingsIcon, Wrench, MessageCircle,
  ChevronDown, ChevronRight, Eraser
} from 'lucide-react';
import { NODE_DEFINITIONS } from '@/lib/agent-engine/node-definitions';
import { 
  getChatHistoryStore, appendMessage, clearStore, ChatHistoryMessage,
  deleteMessage, updateMessageText, moveMessage
} from '@/lib/agent-engine/chat-history-store';

// ─── Role styling config ─────────────────────────────────────
const ROLE_CONFIG: Record<string, {
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  user: {
    icon: <User size={9} />,
    color: '#60a5fa',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.18)',
    label: 'User',
  },
  assistant: {
    icon: <Cpu size={9} />,
    color: '#a78bfa',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.18)',
    label: 'Model',
  },
  system: {
    icon: <SettingsIcon size={9} />,
    color: '#fbbf24',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.18)',
    label: 'System',
  },
  function: {
    icon: <Wrench size={9} />,
    color: '#34d399',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.18)',
    label: 'Function',
  },
};

// ─── Single Message Row ──────────────────────────────────────
const MessageRow = memo(({ 
  msg, idx, total, storeId, onRefresh 
}: { 
  msg: ChatHistoryMessage; 
  idx: number; 
  total: number; 
  storeId: string;
  onRefresh: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [hovered, setHovered] = useState(false);
  const role = ROLE_CONFIG[msg.role] || ROLE_CONFIG.user;

  const startEdit = () => { setEditing(true); setEditContent(msg.content); };
  const saveEdit = () => {
    updateMessageText('default', storeId, msg.id, editContent);
    setEditing(false);
    onRefresh();
  };

  return (
    <div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: role.bg,
        border: `1px solid ${role.border}`,
        borderRadius: 8,
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <div style={{ 
          fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: role.color, display: 'flex', alignItems: 'center', gap: 3,
        }}>
          {role.icon} {role.label}
          {msg.functionCall && (
            <span style={{ 
              fontSize: 7, background: 'rgba(52,211,153,0.15)', color: '#34d399',
              padding: '0 4px', borderRadius: 3, fontFamily: 'var(--font-mono)',
            }}>
              {msg.functionCall.name}()
            </span>
          )}
        </div>

        {/* Action buttons — visible on hover */}
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 1,
          opacity: hovered ? 1 : 0, transition: 'opacity 0.15s ease',
        }}>
          {idx > 0 && (
            <button onClick={() => { moveMessage('default', storeId, msg.id, 'up'); onRefresh(); }}
              style={btnStyle}><ArrowUp size={9} /></button>
          )}
          {idx < total - 1 && (
            <button onClick={() => { moveMessage('default', storeId, msg.id, 'down'); onRefresh(); }}
              style={btnStyle}><ArrowDown size={9} /></button>
          )}
          <button onClick={startEdit} style={btnStyle}><Edit3 size={9} /></button>
          <button onClick={() => { deleteMessage('default', storeId, msg.id); onRefresh(); }}
            style={{ ...btnStyle, color: '#f87171' }}><Trash2 size={9} /></button>
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            style={{
              width: '100%', fontSize: 10, fontFamily: 'var(--font-mono)',
              background: 'rgba(0,0,0,0.4)', border: `1px solid ${role.color}40`,
              borderRadius: 6, padding: '5px 7px', color: '#e2e8f0',
              minHeight: 48, outline: 'none', resize: 'vertical',
              lineHeight: 1.5,
            }}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
            <button onClick={() => setEditing(false)} 
              style={{ ...btnStyle, fontSize: 9, padding: '2px 6px', color: '#94a3b8' }}>
              <X size={10} /> Esc
            </button>
            <button onClick={saveEdit}
              style={{ ...btnStyle, fontSize: 9, padding: '2px 6px', color: '#34d399' }}>
              <Check size={10} /> Ctrl+↵
            </button>
          </div>
        </div>
      ) : (
        <div style={{ 
          fontSize: 10, color: '#c8d0dc', lineHeight: 1.55, whiteSpace: 'pre-wrap',
          wordBreak: 'break-word', maxHeight: 120, overflowY: 'auto',
        }}>
          {msg.content || (msg.functionCall ? JSON.stringify(msg.functionCall.args, null, 2) : '(empty)')}
        </div>
      )}
    </div>
  );
});
MessageRow.displayName = 'MessageRow';

// Mini button style
const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
  padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center',
  transition: 'color 0.1s ease, background 0.1s ease',
};

// ─── MAIN: DatabaseHubNode ───────────────────────────────────
export const DatabaseHubNode = memo(({ id, data, selected }: NodeProps) => {
  const storeId = String((data.settings as any)?.storeId || 'main');
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [role, setRole] = useState<'user' | 'assistant' | 'system' | 'function'>('user');
  const [collapsed, setCollapsed] = useState(false);
  const [fnName, setFnName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshMessages = useCallback(() => {
    const store = getChatHistoryStore('default', storeId);
    setMessages([...store.messages]);
  }, [storeId]);

  useEffect(() => {
    refreshMessages();
    const interval = setInterval(refreshMessages, 800);
    return () => clearInterval(interval);
  }, [refreshMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleAddMessage = () => {
    if (!newMessage.trim() && role !== 'function') return;
    const msgData: any = { role, content: newMessage };
    if (role === 'function' && fnName.trim()) {
      msgData.functionCall = { name: fnName.trim() };
      if (!newMessage.trim()) msgData.content = `Called ${fnName.trim()}()`;
    }
    appendMessage('default', storeId, msgData);
    setNewMessage('');
    setFnName('');
    refreshMessages();
  };

  const handleClear = () => {
    clearStore('default', storeId);
    refreshMessages();
  };

  return (
    <div
      style={{
        minWidth: 380,
        maxWidth: 480,
        borderRadius: 'var(--node-radius, 14px)',
        border: `1px solid ${selected ? 'rgba(139,92,246,0.5)' : 'var(--node-border, rgba(255,255,255,0.07))'}`,
        background: 'var(--node-bg, rgba(14,14,18,0.96))',
        backdropFilter: 'blur(16px)',
        boxShadow: selected 
          ? '0 0 0 2px rgba(139,92,246,0.35), 0 8px 32px rgba(0,0,0,0.5)' 
          : 'var(--node-shadow, 0 2px 16px rgba(0,0,0,0.35))',
        transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ──────────────────────────────────── */}
      <div
        style={{
          padding: '8px 12px',
          background: 'rgba(139,92,246,0.06)',
          borderBottom: '1px solid rgba(139,92,246,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <Database size={14} style={{ color: '#c4b5fd', opacity: 0.85 }} />
        <span style={{
          color: '#e2e8f0', fontSize: 11, fontWeight: 600,
          letterSpacing: '-0.01em', flex: 1,
        }}>
          {(data.label as string) || 'Database Hub'}
        </span>

        {/* Message count badge */}
        <span style={{
          fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)',
          color: messages.length > 0 ? '#a78bfa' : '#475569',
          background: 'rgba(139,92,246,0.1)', padding: '1px 6px', borderRadius: 4,
        }}>
          {messages.length}
        </span>

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(!collapsed)}
          style={{ ...btnStyle, color: '#64748b' }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* ── Store ID bar ────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.015)',
      }}>
        <div style={{ 
          fontSize: 9, color: '#64748b', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ color: '#8b5cf6', fontWeight: 700 }}>STORE</span>
          <span style={{ 
            fontFamily: 'var(--font-mono)', color: '#94a3b8',
            background: 'rgba(255,255,255,0.05)', padding: '0 5px', borderRadius: 3,
          }}>
            {storeId}
          </span>
        </div>
        <button onClick={handleClear} title="Очистить все сообщения"
          style={{ ...btnStyle, color: '#64748b', fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}
          className="nodrag"
        >
          <Eraser size={10} /> Clear
        </button>
      </div>

      {/* ── Body (collapsible) ──────────────────────── */}
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* Messages list */}
          <div ref={scrollRef} className="nodrag" style={{
            maxHeight: 360, minHeight: 80, overflowY: 'auto',
            padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5,
            cursor: 'auto',
          }}>
            {messages.length === 0 ? (
              <div style={{
                padding: '28px 10px', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}>
                <MessageCircle size={20} style={{ color: '#334155' }} />
                <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.6 }}>
                  История пуста.<br/>
                  <span style={{ color: '#64748b' }}>
                    Сообщения появятся при запуске графа<br/>
                    или добавь их вручную ↓
                  </span>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <MessageRow 
                  key={msg.id} 
                  msg={msg} 
                  idx={idx} 
                  total={messages.length}
                  storeId={storeId}
                  onRefresh={refreshMessages}
                />
              ))
            )}
          </div>

          {/* ── Compose bar ──────────────────────────── */}
          <div style={{
            padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.015)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }} className="nodrag">

            {/* Role selector pills */}
            <div style={{ display: 'flex', gap: 3 }}>
              {(['user', 'assistant', 'system', 'function'] as const).map(r => {
                const cfg = ROLE_CONFIG[r];
                const isActive = role === r;
                return (
                  <button key={r} onClick={() => setRole(r)}
                    style={{
                      flex: 1, fontSize: 8, fontWeight: 700, padding: '4px 0',
                      borderRadius: 5, cursor: 'pointer', textTransform: 'uppercase',
                      letterSpacing: '0.04em', transition: 'all 0.15s ease',
                      background: isActive ? cfg.bg : 'transparent',
                      border: `1px solid ${isActive ? cfg.border : 'rgba(255,255,255,0.06)'}`,
                      color: isActive ? cfg.color : '#475569',
                    }}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Function name field (only for function role) */}
            {role === 'function' && (
              <input
                type="text"
                value={fnName}
                onChange={(e) => setFnName(e.target.value)}
                placeholder="Function name (e.g. search_web)"
                style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)',
                  background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
                  borderRadius: 6, padding: '4px 8px', color: '#34d399',
                  outline: 'none',
                }}
              />
            )}

            {/* Input + Send */}
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={role === 'function' ? 'Result or arguments...' : 'Type message...'}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMessage()}
                style={{
                  flex: 1, fontSize: 10, height: 30,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 7, padding: '0 10px', color: '#e2e8f0', outline: 'none',
                }}
              />
              <button onClick={handleAddMessage}
                disabled={!newMessage.trim() && role !== 'function'}
                style={{
                  width: 30, height: 30, borderRadius: 7, border: 'none',
                  background: newMessage.trim() || role === 'function' ? '#8b5cf6' : 'rgba(255,255,255,0.06)',
                  color: newMessage.trim() || role === 'function' ? '#fff' : '#475569',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: newMessage.trim() || role === 'function' ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DatabaseHubNode.displayName = 'DatabaseHubNode';
