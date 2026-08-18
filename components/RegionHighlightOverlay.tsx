'use client';

import { useEffect, useState } from 'react';
import type { ZoomRegion } from '@/types';
import { calculateHighlightPosition } from '@/lib/imageAnalysisHelpers';

interface RegionHighlightOverlayProps {
  region: ZoomRegion;
  imageWidth: number;
  imageHeight: number;
  color?: string;
  animated?: boolean;
}

export default function RegionHighlightOverlay({
  region,
  imageWidth,
  imageHeight,
  color = '#3b82f6',
  animated = true
}: RegionHighlightOverlayProps) {
  const [coords, setCoords] = useState(calculateHighlightPosition(region, imageWidth, imageHeight));

  useEffect(() => {
    setCoords(calculateHighlightPosition(region, imageWidth, imageHeight));
  }, [region, imageWidth, imageHeight]);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${coords.left}px`,
        top: `${coords.top}px`,
        width: `${coords.width}px`,
        height: `${coords.height}px`,
      }}
    >
      {/* Semi-transparent overlay */}
      <div
        className="absolute inset-0 bg-blue-500/10"
        style={{ backgroundColor: `${color}1a` }}
      />
      
      {/* Border */}
      <div
        className={`absolute inset-0 border-2 ${animated ? 'animate-pulse' : ''}`}
        style={{
          borderColor: color,
          boxShadow: `0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.3)`
        }}
      />
      
      {/* Corner handles */}
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-white border-2 rounded-full" style={{ borderColor: color }} />
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white border-2 rounded-full" style={{ borderColor: color }} />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border-2 rounded-full" style={{ borderColor: color }} />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border-2 rounded-full" style={{ borderColor: color }} />
    </div>
  );
}
