/**
 * HuggingFace Space API Caller
 * Выполняет вызовы к Gradio API
 */

import type { ParsedHFEndpoint, ParsedHFParameter } from './parser';
import type { SkillArtifact } from '@/types';

export interface CallResult {
  artifacts: SkillArtifact[];
  rawData: any;
}

/**
 * Вызывает эндпоинт HF Space
 */
export async function callHFSpaceEndpoint(
  apiUrl: string,
  endpoint: ParsedHFEndpoint,
  args: Record<string, unknown>,
  attachedFiles: ReadonlyArray<{ getData: () => Promise<string>; mimeType: string; name: string }>,
  token?: string
): Promise<CallResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Подготавливаем параметры
  const data: any[] = [];
  
  for (let i = 0; i < endpoint.parameters.length; i++) {
    const param = endpoint.parameters[i];
    const argValue = args[param.name];
    
    // Если параметр файловый
    if (isFileType(param.type)) {
      if (attachedFiles.length > 0) {
        // Загружаем файл в Space
        const file = attachedFiles[0];
        const uploadedPath = await uploadFileToSpace(apiUrl, file, token);
        data.push({ path: uploadedPath });
      } else {
        // Файл не прикреплён — пропускаем или используем null
        data.push(null);
      }
    } else {
      // Обычный параметр
      data.push(argValue ?? null);
    }
  }

  // Пробуем новый формат API (Gradio 4.x+)
  try {
    return await callGradio4API(apiUrl, endpoint, data, token);
  } catch (err) {
    console.warn('Gradio 4.x API failed, trying 3.x:', err);
    // Fallback на старый формат
    return await callGradio3API(apiUrl, endpoint, data, token);
  }
}

/**
 * Вызов через Gradio 4.x API (/run/)
 */
async function callGradio4API(
  apiUrl: string,
  endpoint: ParsedHFEndpoint,
  data: any[],
  token?: string
): Promise<CallResult> {
  // Прямой вызов через /run/
  // Убираем префикс "/" если есть
  const endpointName = endpoint.name.replace(/^\//, '');
  const runUrl = `${apiUrl}/run/${endpointName}`;
  
  console.log('[HF Space] Calling:', runUrl, 'with data:', data);
  
  const proxyRes = await fetch('/api/hf-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: runUrl,
      method: 'POST',
      data: { data },
      token,
    }),
  });
  
  const proxyResult = await proxyRes.json();
  
  if (!proxyResult.ok) {
    console.error('[HF Space] Error response:', proxyResult);
    throw new Error(`HTTP ${proxyResult.status}: ${proxyResult.data || proxyResult.statusText}`);
  }
  
  const result = proxyResult.data;
  console.log('[HF Space] Result:', result);
  
  // Gradio 4.x возвращает { data: [...] } напрямую
  const output = result.data || result;
  
  // Конвертируем в артефакты
  const artifacts = await convertOutputToArtifacts(output, endpoint, apiUrl);
  
  return { artifacts, rawData: output };
}

/**
 * Вызов через Gradio 3.x API (/call/ + SSE)
 */
async function callGradio3API(
  apiUrl: string,
  endpoint: ParsedHFEndpoint,
  data: any[],
  token?: string
): Promise<CallResult> {
  // Вызываем эндпоинт
  const callUrl = `${apiUrl}/call/${endpoint.name}`;
  
  let eventId: string;
  try {
    const proxyRes = await fetch('/api/hf-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: callUrl,
        method: 'POST',
        data: { data },
        token,
      }),
    });
    
    const proxyResult = await proxyRes.json();
    
    if (!proxyResult.ok) {
      throw new Error(`HTTP ${proxyResult.status}: ${proxyResult.statusText}`);
    }
    
    const result = proxyResult.data;
    eventId = result.event_id;
    
    if (!eventId) {
      throw new Error('Не получен event_id от Space');
    }
  } catch (err) {
    throw new Error(`Ошибка вызова эндпоинта: ${err}`);
  }

  // Ждём результат через SSE (это всё ещё нужно делать напрямую)
  const output = await waitForResult(apiUrl, eventId, token);
  
  // Конвертируем в артефакты
  const artifacts = await convertOutputToArtifacts(output, endpoint, apiUrl);
  
  return { artifacts, rawData: output };
}

/**
 * Загружает файл в Space через /upload
 */
async function uploadFileToSpace(
  apiUrl: string,
  file: { getData: () => Promise<string>; mimeType: string; name: string },
  token?: string
): Promise<string> {
  const base64 = await file.getData();
  
  // Конвертируем base64 в Blob
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: file.mimeType });
  
  // Загружаем через FormData
  const formData = new FormData();
  formData.append('files', blob, file.name);
  
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  // Прямой запрос (FormData не через прокси)
  const res = await fetch(`${apiUrl}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  
  if (!res.ok) {
    throw new Error(`Ошибка загрузки файла: HTTP ${res.status}`);
  }
  
  const result = await res.json();
  
  // Gradio возвращает массив путей
  if (Array.isArray(result) && result.length > 0) {
    return result[0];
  }
  
  throw new Error('Не получен путь загруженного файла');
}

/**
 * Ждёт результат через SSE
 */
async function waitForResult(apiUrl: string, eventId: string, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${apiUrl}/call/${eventId}`;
    const eventSource = new EventSource(url);
    
    let timeout = setTimeout(() => {
      eventSource.close();
      reject(new Error('Timeout: Space не ответил за 60 секунд'));
    }, 60000);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.msg === 'process_completed') {
          clearTimeout(timeout);
          eventSource.close();
          resolve(data.output?.data || data.output);
        } else if (data.msg === 'error') {
          clearTimeout(timeout);
          eventSource.close();
          reject(new Error(data.error || 'Space вернул ошибку'));
        }
      } catch (err) {
        // Игнорируем ошибки парсинга
      }
    };
    
    eventSource.onerror = () => {
      clearTimeout(timeout);
      eventSource.close();
      reject(new Error('Ошибка соединения с Space'));
    };
  });
}

/**
 * Конвертирует output в артефакты
 */
async function convertOutputToArtifacts(
  output: any,
  endpoint: ParsedHFEndpoint,
  apiUrl: string
): Promise<SkillArtifact[]> {
  const artifacts: SkillArtifact[] = [];
  
  if (!output) return artifacts;
  
  // output может быть массивом или объектом
  const outputs = Array.isArray(output) ? output : [output];
  
  for (let i = 0; i < outputs.length; i++) {
    const item = outputs[i];
    const returnParam = endpoint.returns[i];
    
    if (!item) continue;
    
    // Если это файл (объект с path/url или просто строка-путь)
    if (typeof item === 'object' && (item.path || item.url)) {
      const fileUrl = item.url || (item.path ? `${apiUrl}/file=${item.path}` : null);
      if (fileUrl) {
        const artifact = await createFileArtifact(fileUrl, returnParam, i);
        if (artifact) artifacts.push(artifact);
      }
    }
    // Если это просто путь к файлу (строка начинающаяся с /)
    else if (typeof item === 'string' && item.startsWith('/')) {
      const fileUrl = `${apiUrl}/file=${item}`;
      const artifact = await createFileArtifact(fileUrl, returnParam, i);
      if (artifact) artifacts.push(artifact);
    }
    // Если это текст
    else if (typeof item === 'string') {
      artifacts.push({
        id: `hf_output_${i}_${Date.now()}`,
        type: 'text',
        label: returnParam?.name || `Output ${i + 1}`,
        data: { kind: 'text', content: item },
        downloadable: false,
      });
    }
    // Если это JSON
    else if (typeof item === 'object') {
      artifacts.push({
        id: `hf_output_${i}_${Date.now()}`,
        type: 'text',
        label: returnParam?.name || `Output ${i + 1}`,
        data: { kind: 'text', content: JSON.stringify(item, null, 2) },
        downloadable: false,
      });
    }
  }
  
  return artifacts;
}

/**
 * Создаёт артефакт из файла
 */
async function createFileArtifact(
  url: string,
  param: ParsedHFParameter | undefined,
  index: number
): Promise<SkillArtifact | null> {
  try {
    // Определяем тип артефакта по расширению или типу параметра
    let type: SkillArtifact['type'] = 'image';
    let mimeType = 'image/png';
    
    const urlLower = url.toLowerCase();
    
    // По расширению файла
    if (urlLower.includes('.mp3') || urlLower.includes('.wav') || urlLower.includes('.ogg')) {
      type = 'audio';
      mimeType = 'audio/mpeg';
    } else if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.mov')) {
      type = 'video';
      mimeType = 'video/mp4';
    } else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.webp')) {
      type = 'image';
      mimeType = urlLower.includes('.jpg') || urlLower.includes('.jpeg') ? 'image/jpeg' : 
                 urlLower.includes('.png') ? 'image/png' : 'image/webp';
    }
    
    // По типу параметра
    if (param) {
      if (param.type === 'audio') {
        type = 'audio';
        mimeType = 'audio/mpeg';
      } else if (param.type === 'video') {
        type = 'video';
        mimeType = 'video/mp4';
      }
    }
    
    // Для изображений скачиваем как base64
    if (type === 'image') {
      try {
        const base64 = await fetchAsBase64(url);
        return {
          id: `hf_file_${index}_${Date.now()}`,
          type,
          label: param?.name || 'Generated Image',
          data: { kind: 'base64', mimeType, base64 },
          downloadable: true,
          sendToGemini: true, // Отправляем в Gemini для анализа
        };
      } catch (err) {
        console.warn('Failed to fetch as base64, using URL:', err);
        // Fallback на URL
        return {
          id: `hf_file_${index}_${Date.now()}`,
          type,
          label: param?.name || 'Generated Image',
          data: { kind: 'url', url, mimeType },
          downloadable: true,
          sendToGemini: false,
        };
      }
    }
    
    // Для аудио/видео используем URL
    return {
      id: `hf_file_${index}_${Date.now()}`,
      type,
      label: param?.name || `Generated ${type}`,
      data: { kind: 'url', url, mimeType },
      downloadable: true,
      sendToGemini: false,
    };
  } catch (err) {
    console.error('Ошибка создания артефакта:', err);
    return null;
  }
}

/**
 * Скачивает файл как base64
 */
async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function isFileType(type: string): boolean {
  return ['file', 'image', 'audio', 'video'].includes(type);
}
