import { Film, Clock } from 'lucide-react';

interface VideoFrameIndicatorProps {
  videoSource: string;
  timestampSeconds: number;
  reason?: string;
}

export function VideoFrameIndicator({ videoSource, timestampSeconds, reason }: VideoFrameIndicatorProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-sm">
      <Film className="w-4 h-4 text-purple-400" />
      <div className="flex items-center gap-2">
        <span className="text-purple-300 font-medium">{videoSource}</span>
        <div className="flex items-center gap-1 text-purple-400">
          <Clock className="w-3 h-3" />
          <span className="font-mono">{formatTime(timestampSeconds)}</span>
        </div>
      </div>
      {reason && (
        <span className="text-purple-400/70 text-xs border-l border-purple-500/30 pl-2">
          {reason}
        </span>
      )}
    </div>
  );
}
