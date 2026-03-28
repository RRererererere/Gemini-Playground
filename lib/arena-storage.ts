import type { ArenaSession } from './arena-types';

const SESSIONS_KEY = 'arena_sessions';
const ACTIVE_SESSION_KEY = 'arena_active_session_id';

export function loadArenaSessions(): ArenaSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ArenaSession[];
  } catch {
    return [];
  }
}

export function saveArenaSession(session: ArenaSession): void {
  const sessions = loadArenaSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function deleteArenaSession(id: string): void {
  const sessions = loadArenaSessions().filter(s => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  
  // Если удалённая сессия была активной — сбрасываем
  if (getActiveArenaSessionId() === id) {
    setActiveArenaSessionId(null);
  }
}

export function getActiveArenaSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY) || null;
}

export function setActiveArenaSessionId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
}

export function exportArenaSession(session: ArenaSession): void {
  // Создаём копию без API ключей
  const exportData: ArenaSession = {
    ...session,
    agents: session.agents.map(a => ({ ...a, apiKey: '' })),
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arena-${session.title.slice(0, 30)}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
