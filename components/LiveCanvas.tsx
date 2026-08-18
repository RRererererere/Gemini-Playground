'use client';
import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Code, MonitorPlay } from 'lucide-react';

interface LiveCanvasProps {
  code: string;
  isStreaming?: boolean;
  onUserEvent?: (eventData: any) => void;
  onClose?: () => void;
}

export default function LiveCanvas({ code, isStreaming, onUserEvent, onClose }: LiveCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Скрипт-мост, инжектируемый в iframe (с подпиской на hover видео и обновами DOM без фликера)
  const bridgeScript = `
    <script>
      // 1. Принимаем код от родительского окна без перезагрузки (no iframe flicker)
      window.addEventListener('message', (e) => {
        if (e.data.source === 'live-canvas-update') {
          const parser = new DOMParser();
          const parsed = parser.parseFromString(e.data.code, 'text/html');
          
          // Обновляем тело без моргания iframe
          if (document.body.innerHTML !== parsed.body.innerHTML) {
            document.body.innerHTML = parsed.body.innerHTML;
          }
          
          // Синхронизируем стили (заменяем все style теги)
          const newStyles = Array.from(parsed.head.querySelectorAll('style'));
          const oldStyles = Array.from(document.head.querySelectorAll('style.injected'));
          
          oldStyles.forEach(s => s.remove());
          newStyles.forEach(s => {
            s.classList.add('injected');
            document.head.appendChild(s);
          });
        }
      });

      // 2. Click listener
      window.addEventListener('click', (e) => {
        const el = e.target;
        if (el && el !== document.body && el !== document.documentElement) {
          e.preventDefault();
          e.stopPropagation();
          const data = {
            type: 'click',
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            innerText: el.innerText.substring(0, 100).trim(),
          };
          window.parent.postMessage({ source: 'live-canvas', data }, '*');
        }
      }, true);

      // 3. Hover (Video/Element metadata) listener
      let hoverTimeout;
      let lastHovered = null;

      window.addEventListener('mouseover', (e) => {
        const el = e.target;
        if (el === document.body || el === document.documentElement) return;
        
        clearTimeout(hoverTimeout);
        if (lastHovered && lastHovered !== el) {
          lastHovered.style.outline = '';
          lastHovered.style.outlineOffset = '';
        }
        
        el.style.outline = '2px dashed rgba(99,102,241,0.8)';
        el.style.outlineOffset = '2px';
        el.style.cursor = 'crosshair';
        lastHovered = el;
        
        hoverTimeout = setTimeout(() => {
          let metadata = undefined;
          if (el.tagName === 'VIDEO') {
             metadata = { src: el.src, duration: el.duration, width: el.videoWidth, height: el.videoHeight };
          }
          window.parent.postMessage({ 
            source: 'live-canvas', 
            data: { type: 'hover-info', tagName: el.tagName, hint: 'Кликни чтобы выбрать', metadata }
          }, '*');
        }, 300);
      });

      window.addEventListener('mouseout', (e) => {
        const el = e.target;
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.cursor = '';
        clearTimeout(hoverTimeout);
      });

      // 4. Drag & Drop Listener
      const makeDraggable = () => {
        document.querySelectorAll('body *').forEach(el => {
          if(!el.hasAttribute('draggable')) {
            el.setAttribute('draggable', 'true');
          }
        });
      };
      const observer = new MutationObserver(makeDraggable);
      observer.observe(document.body, { childList: true, subtree: true });
      makeDraggable();

      window.addEventListener('dragstart', (e) => {
        const el = e.target;
        if (el && el.tagName) {
          if (el.tagName === 'IMG') {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = el.width || el.naturalWidth || 100;
              canvas.height = el.height || el.naturalHeight || 100;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(el, 0, 0);
              const dataURL = canvas.toDataURL('image/png');
              e.dataTransfer.setData('application/json', JSON.stringify({ 
                source: 'live-canvas-drag', type: 'image', dataURL, alt: el.alt 
              }));
              e.dataTransfer.effectAllowed = 'copy';
            } catch(e) {}
          } else {
            e.dataTransfer.setData('application/json', JSON.stringify({ 
              source: 'live-canvas-drag', type: 'text', content: el.innerText?.substring(0, 200), tagName: el.tagName
            }));
            e.dataTransfer.setData('text/plain', el.innerText || '');
            e.dataTransfer.effectAllowed = 'copy';
          }
        }
      });

      // 5. Long Press (Mobile Drag Equivalent)
      let touchTimer;
      window.addEventListener('touchstart', (e) => {
        const el = e.target;
        touchTimer = setTimeout(() => {
          if (el.tagName === 'IMG') {
             try {
               const canvas = document.createElement('canvas');
               canvas.width = el.width || el.naturalWidth || 100;
               canvas.height = el.height || el.naturalHeight || 100;
               const ctx = canvas.getContext('2d');
               ctx.drawImage(el, 0, 0);
               const dataURL = canvas.toDataURL('image/png');
               window.parent.postMessage({ source: 'live-canvas', data: { type: 'mobile-drag', payload: { type: 'image', dataURL, alt: el.alt } } }, '*');
             } catch(err) {}
          } else if (el.tagName && el.innerText) {
             window.parent.postMessage({ source: 'live-canvas', data: { type: 'mobile-drag', payload: { type: 'text', content: el.innerText.substring(0,200), tagName: el.tagName } } }, '*');
          }
        }, 600);
      });
      window.addEventListener('touchend', () => clearTimeout(touchTimer));
      window.addEventListener('touchmove', () => clearTimeout(touchTimer));
    </script>
  `;

  const getSrcDoc = () => {
    if (!code) return '';
    if (code.includes('</body>')) {
      return code.replace('</body>', bridgeScript + '</body>');
    }
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { margin: 0; padding: 16px; font-family: sans-serif; transition: all 0.3s ease; }
            * { 
              animation: _canvas_appear 0.2s ease forwards;
            }
            @keyframes _canvas_appear {
              from { opacity: 0.6; }
              to { opacity: 1; }
            }
          </style>
        </head>
        <body>
          <div id="loading" style="display:flex; height:100vh; align-items:center; justify-content:center; color:#9ca3af; font-family:sans-serif;">
            Подготовка холста...
          </div>
          ${bridgeScript}
        </body>
      </html>
    `;
  };

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.source === 'live-canvas' && onUserEvent) {
        onUserEvent(e.data.data);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onUserEvent]);

  const isRenderedRef = useRef(false);

  useEffect(() => {
    if (iframeRef.current && !isRenderedRef.current) {
      iframeRef.current.srcdoc = getSrcDoc();
      // Ждём загрузки базового DOM, прежде чем парсить первый код
      iframeRef.current.onload = () => {
         isRenderedRef.current = true;
         if (code) {
           iframeRef.current?.contentWindow?.postMessage({ source: 'live-canvas-update', code }, '*');
         }
      };
    } else if (isRenderedRef.current && iframeRef.current?.contentWindow) {
      // Плавное обновление через postMessage без фликера iframe
      iframeRef.current.contentWindow.postMessage({ source: 'live-canvas-update', code }, '*');
    }
  }, [code]);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-1)] text-[var(--text-primary)] relative">
      <div className="flex-shrink-0 h-10 border-b border-[var(--border-subtle)] bg-[rgba(10,10,10,0.86)] flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-[var(--accent)] text-xs font-semibold uppercase tracking-wider">
          <MonitorPlay size={14} />
          <span>Live Canvas</span>
          {isStreaming && (
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] animate-pulse ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping inline-block" />
              AI генерирует...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="text-[var(--text-dim)] hover:text-red-400 transition"
              title="Закрыть Canvas"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 w-full bg-white relative overflow-hidden">
        {code ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Live Canvas"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300 flex-col gap-3">
            <Code size={48} />
            <p className="text-sm">Ждем HTML/CSS/JS код...</p>
          </div>
        )}
      </div>
    </div>
  );
}
