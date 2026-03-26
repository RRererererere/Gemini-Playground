import { NextRequest, NextResponse } from 'next/server';

// Этот endpoint будет вызываться из iframe сайта через fetch
// Он не может напрямую обратиться к IndexedDB, поэтому возвращаем JavaScript
// который выполнится в контексте родительского окна

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  // Возвращаем JavaScript который загрузит из IndexedDB родительского окна
  const script = `
(function() {
  const id = '${id}';
  
  // Пытаемся получить доступ к IndexedDB родительского окна
  const dbRequest = window.parent.indexedDB.open('gemini_studio_files', 1);
  
  dbRequest.onsuccess = function(e) {
    const db = e.target.result;
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const getRequest = store.get(id);
    
    getRequest.onsuccess = function() {
      const base64 = getRequest.result;
      if (base64) {
        // Определяем MIME type
        let mimeType = 'image/jpeg';
        if (base64.startsWith('/9j/')) mimeType = 'image/jpeg';
        else if (base64.startsWith('iVBORw0KGgo')) mimeType = 'image/png';
        else if (base64.startsWith('R0lGOD')) mimeType = 'image/gif';
        else if (base64.startsWith('UklGR')) mimeType = 'image/webp';
        
        // Отправляем результат обратно
        window.parent.postMessage({
          type: 'IMAGE_LOADED',
          id: id,
          data: 'data:' + mimeType + ';base64,' + base64
        }, '*');
      }
    };
  };
})();
`;
  
  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache'
    }
  });
}
