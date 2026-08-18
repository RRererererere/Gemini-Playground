'use client';
import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { RefreshCw, Code, MonitorPlay, Maximize2, Minimize2, Download, Copy, Check, MousePointer2, Search, Zap } from 'lucide-react';
import type { CanvasElement, BridgePayload, PreviewMode, WebsiteType } from '@/types';

interface LivePreviewPanelProps {
  code: string;
  isStreaming?: boolean;
  websiteType?: WebsiteType;
  onElementSelected?: (element: CanvasElement) => void;
  onAIDataReceived?: (payload: BridgePayload) => void;
  onClose?: () => void;
  className?: string;
}

export interface LivePreviewPanelRef {
  sendAIResponseToSite: (type: string, payload: any) => void;
}

const LivePreviewPanel = forwardRef<LivePreviewPanelRef, LivePreviewPanelProps>(({ 
  code, 
  isStreaming,
  websiteType = null,
  onElementSelected,
  onAIDataReceived,
  onClose,
  className = ''
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('interact');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const isRenderedRef = useRef(false);
  const prevCodeRef = useRef(''); // Track previous code to avoid unnecessary updates
  const isBridgeResponseRef = useRef(false); // Track if this is a bridge response (AI answered site data) vs new generation
  
  // Auto-switch to ai-app mode for ai_interactive websites
  useEffect(() => {
    if (websiteType === 'ai_interactive' && previewMode === 'interact') {
      setPreviewMode('ai-app');
    } else if (websiteType === 'static' && previewMode === 'ai-app') {
      setPreviewMode('inspect');
    }
  }, [websiteType]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    sendAIResponseToSite: (type: string, payload: any) => {
      // Temporarily disabled - not needed yet
      // iframeRef.current?.contentWindow?.postMessage({
      //   source: 'gemini-ai-response',
      //   type,
      //   payload
      // }, '*');
    }
  }));

  // Bridge script для bidirectional communication
  const getBridgeScript = useCallback(() => {
    return `
    <script>
      (function() {
        // ═══════════════════════════════════════════════════════════
        // GEMINI BRIDGE PROTOCOL — AI ↔ Site Communication
        // ═══════════════════════════════════════════════════════════
        
        window.GeminiBridge = {
          // Send data to AI (from site to chat)
          send: function(eventType, data, format) {
            console.log('[GeminiBridge] Sending to AI:', eventType, data);
            window.parent.postMessage({
              source: 'gemini-bridge',
              action: 'send_to_ai',
              eventType: eventType,
              data: data,
              format: format || 'auto'
            }, '*');
          },
          
          // Register response handler (AI → site)
          onResponse: function(handler) {
            window.__geminiBridgeHandler = handler;
            console.log('[GeminiBridge] Response handler registered');
          },
          
          // Show loading state while AI thinks
          setLoading: function(isLoading) {
            window.parent.postMessage({
              source: 'gemini-bridge',
              action: 'set_loading',
              isLoading: isLoading
            }, '*');
          }
        };
        
        // Listen for AI responses
        window.addEventListener('message', (e) => {
          if (e.data?.source === 'gemini-ai-response') {
            console.log('[GeminiBridge] Received AI response:', e.data);
            if (typeof window.__geminiBridgeHandler === 'function') {
              window.__geminiBridgeHandler(e.data.type, e.data.payload);
            }
          }
        });
        
        console.log('[GeminiBridge] Initialized successfully');
        
        // ═══════════════════════════════════════════════════════════
        // STANDARD BRIDGE — Click, Hover, Drag
        // ═══════════════════════════════════════════════════════════
        
        const mode = '${previewMode}';
        console.log('[LivePreview] Mode:', mode);
        
        // 1. Receive code updates from parent (no flicker)
        window.addEventListener('message', (e) => {
          if (e.data.source === 'live-preview-update') {
            const parser = new DOMParser();
            const parsed = parser.parseFromString(e.data.code, 'text/html');
            
            if (document.body.innerHTML !== parsed.body.innerHTML) {
              document.body.innerHTML = parsed.body.innerHTML;
              if (mode === 'inspect') makeDraggable();
            }
            
            const newStyles = Array.from(parsed.head.querySelectorAll('style'));
            const oldStyles = Array.from(document.head.querySelectorAll('style.injected'));
            
            oldStyles.forEach(s => s.remove());
            newStyles.forEach(s => {
              s.classList.add('injected');
              document.head.appendChild(s);
            });
          }
        });

        // 2. Click listener (only in inspect mode)
        if (mode === 'inspect') {
          window.addEventListener('click', (e) => {
            const el = e.target;
            if (el && el !== document.body && el !== document.documentElement) {
              e.preventDefault();
              e.stopPropagation();
              
              const data = {
                type: 'click',
                tagName: el.tagName,
                id: el.id || undefined,
                className: el.className || undefined,
                innerText: el.innerText?.substring(0, 200).trim() || undefined,
              };
              
              window.parent.postMessage({ source: 'live-preview', data }, '*');
            }
          }, true);
        }

        // 3. Hover listener (only in inspect mode)
        if (mode === 'inspect') {
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
                metadata = { 
                  src: el.src, 
                  duration: el.duration, 
                  width: el.videoWidth, 
                  height: el.videoHeight 
                };
              } else if (el.tagName === 'IMG') {
                metadata = {
                  src: el.src,
                  alt: el.alt,
                  width: el.width,
                  height: el.height
                };
              }
              
              window.parent.postMessage({ 
                source: 'live-preview', 
                data: { 
                  type: 'hover', 
                  tagName: el.tagName,
                  id: el.id,
                  className: el.className,
                  metadata 
                }
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
        }

        // 4. Drag & Drop (only in inspect mode)
        function makeDraggable() {
          document.querySelectorAll('body *').forEach(el => {
            if (!el.hasAttribute('draggable')) {
              el.setAttribute('draggable', 'true');
            }
          });
        }

        if (mode === 'inspect') {
          const observer = new MutationObserver(makeDraggable);
          observer.observe(document.body, { childList: true, subtree: true });
          makeDraggable();

          window.addEventListener('dragstart', (e) => {
            const el = e.target;
            if (!el || !el.tagName) return;
            
            if (el.tagName === 'IMG') {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = el.width || el.naturalWidth || 100;
                canvas.height = el.height || el.naturalHeight || 100;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(el, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                
                e.dataTransfer.setData('application/json', JSON.stringify({ 
                  source: 'live-preview-drag', 
                  type: 'drag-image',
                  tagName: 'IMG',
                  dataURL, 
                  alt: el.alt,
                  id: el.id,
                  className: el.className
                }));
                e.dataTransfer.effectAllowed = 'copy';
              } catch(err) {}
            } else {
              const text = el.innerText?.substring(0, 500) || '';
              e.dataTransfer.setData('application/json', JSON.stringify({ 
                source: 'live-preview-drag', 
                type: 'drag-text',
                tagName: el.tagName,
                innerText: text,
                id: el.id,
                className: el.className
              }));
              e.dataTransfer.setData('text/plain', text);
              e.dataTransfer.effectAllowed = 'copy';
            }
          });
        }
      })();
    </script>
  `;
  }, [previewMode]);

  const getSrcDoc = () => {
    if (!code) return '';
    
    const bridgeScript = getBridgeScript();
    
    // If code has full HTML structure
    if (code.includes('</body>')) {
      return code.replace('</body>', bridgeScript + '</body>');
    }
    
    // Otherwise wrap in basic template
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              margin: 0; 
              padding: 16px; 
              font-family: system-ui, -apple-system, sans-serif;
            }
            
            /* 🔥 LIVE BUILD ANIMATION - элементы появляются по мере написания */
            ${isStreaming ? `
            * { 
              animation: _live_appear 0.3s ease-out forwards;
              opacity: 0;
            }
            @keyframes _live_appear {
              from { 
                opacity: 0; 
                transform: translateY(8px) scale(0.98);
              }
              to { 
                opacity: 1; 
                transform: translateY(0) scale(1);
              }
            }
            ` : ''}
          </style>
        </head>
        <body>
          ${code}
          ${bridgeScript}
        </body>
      </html>
    `;
  };

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Gemini Bridge Protocol
      if (e.data?.source === 'gemini-bridge') {
        if (e.data.action === 'send_to_ai' && onAIDataReceived) {
          onAIDataReceived({
            eventType: e.data.eventType,
            data: e.data.data,
            format: e.data.format
          });
        }
        if (e.data.action === 'set_loading') {
          setIsAIProcessing(e.data.isLoading);
        }
        return;
      }
      
      // Standard preview events
      if (e.data?.source === 'live-preview' && e.data.data) {
        const { type, ...rest } = e.data.data;
        
        if (type === 'click' && onElementSelected) {
          onElementSelected({ type: 'click', ...rest } as CanvasElement);
        } else if (type === 'hover') {
          setHoverInfo(`${rest.tagName}${rest.id ? '#' + rest.id : ''}${rest.className ? '.' + rest.className.split(' ')[0] : ''}`);
        } else if (type === 'mobile-drag' && onElementSelected) {
          onElementSelected(rest.payload as CanvasElement);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelected, onAIDataReceived]);

  // Update iframe content during streaming via postMessage (fast, no script re-execution)
  useEffect(() => {
    if (!code) return;
    
    if (iframeRef.current && !isRenderedRef.current) {
      // Initial render
      iframeRef.current.srcdoc = getSrcDoc();
      iframeRef.current.onload = () => {
        isRenderedRef.current = true;
        prevCodeRef.current = code;
      };
    } else if (isStreaming && isRenderedRef.current && iframeRef.current?.contentWindow) {
      // During streaming: only send postMessage if code changed
      if (code !== prevCodeRef.current) {
        prevCodeRef.current = code;
        iframeRef.current.contentWindow.postMessage({ 
          source: 'live-preview-update', 
          code: getSrcDoc() 
        }, '*');
      }
    }
  }, [code, isStreaming, getBridgeScript]); // Now depends on code, isStreaming, and getBridgeScript

  // Reload iframe when streaming ends so all scripts execute
  useEffect(() => {
    if (!isStreaming && code && isRenderedRef.current && !isBridgeResponseRef.current) {
      // Streaming just ended — do full srcdoc reload so all scripts execute
      isRenderedRef.current = false;
      prevCodeRef.current = '';
      iframeRef.current!.srcdoc = getSrcDoc();
      iframeRef.current!.onload = () => {
        isRenderedRef.current = true;
        prevCodeRef.current = code;
      };
    }
    // Reset bridge flag after isStreaming changes
    if (!isStreaming) {
      isBridgeResponseRef.current = false;
    }
  }, [isStreaming, getBridgeScript]);

  // Reload iframe when previewMode changes to reinitialize bridge with correct mode
  useEffect(() => {
    if (code && isRenderedRef.current && iframeRef.current) {
      isRenderedRef.current = false;
      prevCodeRef.current = '';
      iframeRef.current.srcdoc = getSrcDoc();
      iframeRef.current.onload = () => {
        isRenderedRef.current = true;
        prevCodeRef.current = code;
      };
    }
  }, [previewMode, getBridgeScript]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      isRenderedRef.current = false; // Reset render flag
      prevCodeRef.current = ''; // Reset code tracking
      iframeRef.current.srcdoc = getSrcDoc();
      iframeRef.current.onload = () => {
        isRenderedRef.current = true;
        prevCodeRef.current = code;
      };
    }
  }, [code, getBridgeScript]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'website.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [code]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  return (
    <div className={`flex flex-col h-full bg-[var(--surface-1)] text-[var(--text-primary)] ${isFullscreen ? 'fixed inset-0 z-50' : ''} ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 h-10 border-b border-[var(--border-subtle)] bg-[rgba(10,10,10,0.86)] flex items-center justify-between px-2 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[var(--accent)] text-xs font-semibold uppercase tracking-wider">
            <MonitorPlay size={14} />
            <span className="hidden sm:inline">Live Preview</span>
          </div>
          
          {isStreaming && (
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping inline-block" />
              <span className="hidden sm:inline">Генерация...</span>
            </div>
          )}
          
          {hoverInfo && (
            <div className="hidden md:block text-[10px] text-[var(--text-dim)] font-mono">
              {hoverInfo}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={handleRefresh}
            className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition p-1"
            title="Обновить"
          >
            <RefreshCw size={14} />
          </button>
          
          <button
            onClick={handleCopyCode}
            className="hidden sm:flex text-[var(--text-dim)] hover:text-[var(--text-primary)] transition p-1"
            title="Копировать код"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
          
          <button
            onClick={handleDownload}
            className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition p-1"
            title="Скачать HTML"
          >
            <Download size={14} />
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex text-[var(--text-dim)] hover:text-[var(--text-primary)] transition p-1"
            title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="text-[var(--text-dim)] hover:text-red-400 transition p-1"
              title="Закрыть"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      {/* Preview Area */}
      <div className="flex-1 w-full bg-white relative overflow-hidden">
        {code ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="Live Preview"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 flex-col gap-3 p-8">
            <Code size={48} strokeWidth={1.5} className="opacity-40" />
            <p className="text-sm font-medium text-gray-500">Нет данных для отображения</p>
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Попроси AI создать сайт, и он появится здесь в реальном времени
            </p>
          </div>
        )}
        
        {/* Toolbar - Mode Switcher */}
        {code && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[rgba(10,10,10,0.95)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-full px-2 py-1.5 flex items-center gap-1 shadow-2xl">
            {(websiteType === 'static' || !websiteType) && (
              <>
                <button
                  onClick={() => setPreviewMode('interact')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    previewMode === 'interact'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
                  }`}
                  title="Обычный режим — формы работают, ссылки кликабельны"
                >
                  <MousePointer2 size={14} />
                  <span className="hidden sm:inline">Interact</span>
                </button>
                
                <button
                  onClick={() => setPreviewMode('inspect')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    previewMode === 'inspect'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
                  }`}
                  title="Режим инспекции — клик на элемент → информация в чат"
                >
                  <Search size={14} />
                  <span className="hidden sm:inline">Inspect</span>
                </button>
              </>
            )}
            
            {websiteType === 'ai_interactive' && (
              <>
                <button
                  onClick={() => setPreviewMode('interact')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    previewMode === 'interact'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
                  }`}
                  title="Обычный режим — формы работают"
                >
                  <MousePointer2 size={14} />
                  <span className="hidden sm:inline">Interact</span>
                </button>
                
                <button
                  onClick={() => setPreviewMode('ai-app')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    previewMode === 'ai-app'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
                  }`}
                  title="AI App режим — GeminiBridge активен, данные отправляются AI"
                >
                  <Zap size={14} />
                  <span className="hidden sm:inline">AI App</span>
                  {isAIProcessing && (
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

LivePreviewPanel.displayName = 'LivePreviewPanel';

export default LivePreviewPanel;
