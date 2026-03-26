// IndexedDB storage for large files (images, audio)
// localStorage has ~5-10MB limit, IndexedDB has ~50MB+ (varies by browser)

const DB_NAME = 'gemini_studio_files';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

  return dbPromise;
}

// Save file data to IndexedDB
export async function saveFileData(fileId: string, data: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data, fileId);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save file to IndexedDB:', err);
    throw err;
  }
}

// Load file data from IndexedDB
export async function loadFileData(fileId: string): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(fileId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load file from IndexedDB:', err);
    return null;
  }
}

// Delete file data from IndexedDB
export async function deleteFileData(fileId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(fileId);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to delete file from IndexedDB:', err);
  }
}

// Save multiple files
export async function saveFiles(files: Array<{ id: string; data: string }>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    for (const file of files) {
      store.put(file.data, file.id);
    }
    
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save files to IndexedDB:', err);
    throw err;
  }
}

// Load multiple files
export async function loadFiles(fileIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const promises = fileIds.map(id => 
      new Promise<void>((resolve) => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) {
            result.set(id, request.result);
          }
          resolve();
        };
        request.onerror = () => resolve(); // Skip failed loads
      })
    );
    
    await Promise.all(promises);
  } catch (err) {
    console.error('Failed to load files from IndexedDB:', err);
  }
  
  return result;
}

// Clear all files (for cleanup)
export async function clearAllFiles(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to clear files from IndexedDB:', err);
  }
}

// Get file with metadata (searches in current chat messages from localStorage)
export async function getFile(fileId: string): Promise<{
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string;
} | null> {
  try {
    // Load base64 data from IndexedDB
    const data = await loadFileData(fileId);
    if (!data) return null;

    // Try to find metadata in localStorage chats
    if (typeof window !== 'undefined') {
      const chatsJson = localStorage.getItem('chats');
      if (chatsJson) {
        const chats = JSON.parse(chatsJson);
        
        // Search through all chats for this file
        for (const chat of chats) {
          if (chat.messages) {
            for (const message of chat.messages) {
              if (message.files) {
                const file = message.files.find((f: any) => f.id === fileId);
                if (file) {
                  return {
                    id: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    size: file.size,
                    data
                  };
                }
              }
            }
          }
        }
      }
    }

    // Fallback: return with minimal metadata
    return {
      id: fileId,
      name: 'image.png',
      mimeType: 'image/png',
      size: Math.round((data.length * 3) / 4),
      data
    };
  } catch (err) {
    console.error('Failed to get file:', err);
    return null;
  }
}
