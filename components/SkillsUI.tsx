'use client';

import type { SkillToast, SkillBadge } from '@/lib/useSkillsUI';

// ─────────────────────────────────────────────────────────────────────────────
// Toast container
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_STYLES = {
  default: 'bg-[#1e1e2e] border-white/15 text-white/80',
  success: 'bg-green-950 border-green-500/30 text-green-300',
  error: 'bg-red-950 border-red-500/30 text-red-300',
  warning: 'bg-amber-950 border-amber-500/30 text-amber-300',
};

const VARIANT_ICONS = {
  default: '💬',
  success: '✅',
  error: '❌',
  warning: '⚠️',
};

export function SkillsToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: SkillToast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9998] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl
            text-sm pointer-events-auto
            animate-in slide-in-from-right-5 fade-in duration-300
            ${VARIANT_STYLES[toast.variant]}
          `}
        >
          <span className="text-base">{VARIANT_ICONS[toast.variant]}</span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="opacity-40 hover:opacity-80 transition-opacity ml-2"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Active skills badges strip (показывается в header/toolbar)
// ─────────────────────────────────────────────────────────────────────────────

export function SkillsBadgesStrip({
  badges,
  onClear,
}: {
  badges: Record<string, SkillBadge>;
  onClear: (skillId: string) => void;
}) {
  const list = Object.values(badges);
  if (list.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map(badge => (
        <div
          key={badge.skillId}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
          style={{
            backgroundColor: badge.color ? `${badge.color}18` : '#6366f118',
            borderColor: badge.color ? `${badge.color}40` : '#6366f140',
            color: badge.color ?? '#a5b4fc',
          }}
        >
          <span>{badge.text}</span>
          <button
            onClick={() => onClear(badge.skillId)}
            className="opacity-50 hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills button (для toolbar — показывает кол-во активных)
// ─────────────────────────────────────────────────────────────────────────────

export function SkillsButton({
  activeCount,
  onClick,
}: {
  activeCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs transition-all"
      title="Маркет скиллов"
    >
      <span>✨</span>
      <span>Скиллы</span>
      {activeCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-indigo-600 text-white text-[9px] font-bold">
          {activeCount}
        </span>
      )}
    </button>
  );
}
