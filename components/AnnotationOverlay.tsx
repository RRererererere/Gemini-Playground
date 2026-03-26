'use client';

import { useState } from 'react';
import type { AnnotationItem, AnnotationType } from '@/types';

interface AnnotationOverlayProps {
  annotations: AnnotationItem[];
  imageWidth: number;
  imageHeight: number;
  onAnnotationClick?: (annotation: AnnotationItem) => void;
}

// Стили для разных типов аннотаций
const annotationStyles: Record<AnnotationType, {
  border: string;
  bg: string;
  badgeBg: string;
  badgeText: string;
}> = {
  highlight: {
    border: '2px dashed #FBBF24',
    bg: 'rgba(251, 191, 36, 0.1)',
    badgeBg: 'bg-yellow-500',
    badgeText: 'text-black'
  },
  pointer: {
    border: '2px solid #60A5FA',
    bg: 'rgba(96, 165, 250, 0.08)',
    badgeBg: 'bg-blue-500',
    badgeText: 'text-white'
  },
  warning: {
    border: '2px solid #F87171',
    bg: 'rgba(248, 113, 113, 0.1)',
    badgeBg: 'bg-red-500',
    badgeText: 'text-white'
  },
  success: {
    border: '2px solid #4ADE80',
    bg: 'rgba(74, 222, 128, 0.08)',
    badgeBg: 'bg-green-500',
    badgeText: 'text-white'
  },
  info: {
    border: '1.5px solid #A78BFA',
    bg: 'rgba(167, 139, 250, 0.08)',
    badgeBg: 'bg-purple-500',
    badgeText: 'text-white'
  }
};

// SVG стрелки для pointer типа
const Arrow = ({ direction, color }: { direction: string; color: string }) => {
  const paths: Record<string, string> = {
    'top-left': 'M 0 0 L 20 10 L 10 20 Z',
    'top-right': 'M 20 0 L 0 10 L 10 20 Z',
    'bottom-left': 'M 0 20 L 20 10 L 10 0 Z',
    'bottom-right': 'M 20 20 L 0 10 L 10 0 Z'
  };

  const positions: Record<string, { top?: string; bottom?: string; left?: string; right?: string }> = {
    'top-left': { top: '-12px', left: '-12px' },
    'top-right': { top: '-12px', right: '-12px' },
    'bottom-left': { bottom: '-12px', left: '-12px' },
    'bottom-right': { bottom: '-12px', right: '-12px' }
  };

  return (
    <svg
      className="absolute pointer-events-none"
      style={positions[direction]}
      width="20"
      height="20"
      viewBox="0 0 20 20"
    >
      <path d={paths[direction]} fill={color} />
    </svg>
  );
};

export default function AnnotationOverlay({
  annotations,
  imageWidth,
  imageHeight,
  onAnnotationClick
}: AnnotationOverlayProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <>
      {annotations.map((annotation, index) => {
        const style = annotationStyles[annotation.type];
        const isHovered = hoveredIndex === index;

        // Клампим координаты к 0-100 для безопасности
        const x1 = Math.max(0, Math.min(100, annotation.x1_pct));
        const y1 = Math.max(0, Math.min(100, annotation.y1_pct));
        const x2 = Math.max(0, Math.min(100, annotation.x2_pct));
        const y2 = Math.max(0, Math.min(100, annotation.y2_pct));

        // Проверяем что x2 > x1 и y2 > y1
        if (x2 <= x1 || y2 <= y1) {
          console.warn('Invalid annotation coordinates:', annotation);
          return null;
        }

        // Вычисляем позицию в пикселях
        const left = (x1 / 100) * imageWidth;
        const top = (y1 / 100) * imageHeight;
        const width = ((x2 - x1) / 100) * imageWidth;
        const height = ((y2 - y1) / 100) * imageHeight;

        // Считаем аннотацию маленькой если площадь < 3000px² (например 50x60)
        const isSmall = width * height < 3000;

        return (
          <div
            key={index}
            className="absolute transition-all duration-200 cursor-pointer"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
              pointerEvents: 'auto'
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={(e) => {
              e.stopPropagation();
              onAnnotationClick?.(annotation);
            }}
          >
            {/* Фон */}
            <div
              className="absolute inset-0"
              style={{
                background: style.bg,
                border: style.border,
                borderRadius: '4px',
                opacity: isHovered ? 1 : 0.85,
                boxShadow: isHovered
                  ? '0 0 0 2px rgba(255,255,255,0.3), 0 4px 12px rgba(0,0,0,0.2)'
                  : '0 0 0 1px rgba(0,0,0,0.2)'
              }}
            />

            {/* Стрелка для pointer типа */}
            {annotation.type === 'pointer' && annotation.arrow_direction && annotation.arrow_direction !== 'none' && (
              <Arrow direction={annotation.arrow_direction} color="#60A5FA" />
            )}

            {/* Лейбл (badge) */}
            <div
              className={`absolute left-0 px-2 py-1 text-xs font-medium rounded shadow-lg transition-all duration-200 ${style.badgeBg} ${style.badgeText} ${
                isSmall ? (isHovered ? 'opacity-100' : 'opacity-0') : 'opacity-100'
              }`}
              style={{
                bottom: '4px', // Внутри рамки, а не снаружи
                maxWidth: `${Math.max(width - 8, 80)}px`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                boxShadow: isHovered
                  ? '0 4px 12px rgba(0,0,0,0.3)'
                  : '0 2px 6px rgba(0,0,0,0.2)'
              }}
            >
              <span className="inline-block mr-1">●</span>
              {annotation.label}
            </div>

            {/* Пульсация для warning */}
            {annotation.type === 'warning' && (
              <div
                className="absolute inset-0 animate-pulse"
                style={{
                  border: '2px solid #F87171',
                  borderRadius: '4px',
                  opacity: 0.5
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
