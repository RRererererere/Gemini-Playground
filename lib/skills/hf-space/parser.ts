/**
 * HuggingFace Space API Parser
 * Парсит Gradio API схему из /info эндпоинта
 */

export interface ParsedHFEndpoint {
  id: number;
  name: string;
  description?: string;
  parameters: ParsedHFParameter[];
  returns: ParsedHFParameter[];
  hasFileInput: boolean;
  hasFileOutput: boolean;
}

export interface ParsedHFParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'image' | 'audio' | 'video' | 'array' | 'object';
  description?: string;
  optional?: boolean;
  component?: string; // Gradio component type
}

export interface ParsedHFSpace {
  spaceId: string;
  title: string;
  apiUrl: string;
  endpoints: ParsedHFEndpoint[];
  version: string; // Gradio version
}

/**
 * Нормализует URL Space в формат owner/space
 */
export function normalizeSpaceUrl(input: string): string {
  input = input.trim();
  
  // huggingface.co/spaces/owner/space
  const match1 = input.match(/huggingface\.co\/spaces\/([^\/]+\/[^\/\?#]+)/);
  if (match1) return match1[1];
  
  // owner-space.hf.space
  const match2 = input.match(/([^\/]+)\.hf\.space/);
  if (match2) return match2[1].replace('-', '/');
  
  // owner/space
  if (input.includes('/') && !input.includes('.')) return input;
  
  throw new Error('Неверный формат URL. Используй: huggingface.co/spaces/owner/space или owner/space');
}

/**
 * Получает API URL для Space
 */
export function getSpaceApiUrl(spaceId: string): string {
  const [owner, space] = spaceId.split('/');
  return `https://${owner}-${space}.hf.space`;
}

/**
 * Парсит Gradio API схему
 */
export async function parseHFSpace(urlOrId: string, token?: string): Promise<ParsedHFSpace> {
  const spaceId = normalizeSpaceUrl(urlOrId);
  const apiUrl = getSpaceApiUrl(spaceId);
  
  // Сначала пробуем получить конфиг через /info (Gradio 4.x+)
  try {
    const infoUrl = `${apiUrl}/info`;
    const res = await fetchViaProxy(infoUrl, 'GET', undefined, token);
    
    if (res.ok && res.data) {
      const info = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (info && (info.named_endpoints || info.endpoints)) {
        return parseGradioInfo(info, spaceId, apiUrl);
      }
    }
  } catch (err) {
    console.warn('Failed to fetch /info:', err);
  }
  
  // Fallback: пробуем получить через /config (старые Gradio)
  try {
    const configUrl = `${apiUrl}/config`;
    const res = await fetchViaProxy(configUrl, 'GET', undefined, token);
    
    if (res.ok && res.data) {
      const config = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (config && config.components) {
        return parseGradioConfig(config, spaceId, apiUrl);
      }
    }
  } catch (err) {
    console.warn('Failed to fetch /config:', err);
  }
  
  throw new Error(
    `Не удалось получить API схему для ${spaceId}. ` +
    `Убедись что Space существует и доступен. ` +
    `Попробуй открыть https://huggingface.co/spaces/${spaceId} в браузере.`
  );
}

/**
 * Fetch через прокси для обхода CORS
 */
async function fetchViaProxy(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  data?: any,
  token?: string
): Promise<{ ok: boolean; status: number; data: any }> {
  if (method === 'GET') {
    const params = new URLSearchParams({ url });
    if (token) params.append('token', token);
    
    const res = await fetch(`/api/hf-proxy?${params}`);
    return await res.json();
  } else {
    const res = await fetch('/api/hf-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method, data, token }),
    });
    return await res.json();
  }
}

/**
 * Парсит /info ответ (Gradio 4.x)
 */
function parseGradioInfo(info: any, spaceId: string, apiUrl: string): ParsedHFSpace {
  const endpoints: ParsedHFEndpoint[] = [];
  
  if (info.named_endpoints) {
    // Gradio 4.x
    for (const [path, endpoint] of Object.entries(info.named_endpoints)) {
      const ep = endpoint as any;
      endpoints.push(parseGradio4Endpoint(path, ep));
    }
  } else if (info.endpoints) {
    // Gradio 3.x
    for (let i = 0; i < info.endpoints.length; i++) {
      const ep = info.endpoints[i];
      endpoints.push(parseGradio3Endpoint(i, ep));
    }
  }
  
  if (endpoints.length === 0) {
    throw new Error('Space не содержит доступных эндпоинтов');
  }
  
  return {
    spaceId,
    title: info.title || spaceId,
    apiUrl,
    endpoints,
    version: info.version || 'unknown',
  };
}

/**
 * Парсит /config ответ (Gradio 3.x)
 */
function parseGradioConfig(config: any, spaceId: string, apiUrl: string): ParsedHFSpace {
  const endpoints: ParsedHFEndpoint[] = [];
  
  console.log('[HF Space Parser] Config:', config);
  
  // В config.dependencies находятся эндпоинты
  if (config.dependencies) {
    for (let i = 0; i < config.dependencies.length; i++) {
      const dep = config.dependencies[i];
      if (dep.api_name) {
        const endpoint = {
          id: i,
          name: dep.api_name.replace(/^\//, ''),
          description: dep.documentation?.[0]?.[0] || undefined,
          parameters: (dep.inputs || []).map((idx: number) => {
            const comp = config.components[idx];
            return {
              name: comp?.label || `input_${idx}`,
              type: mapComponentToType(comp?.type || 'textbox'),
              description: comp?.info,
              optional: !comp?.required,
              component: comp?.type,
            };
          }),
          returns: (dep.outputs || []).map((idx: number) => {
            const comp = config.components[idx];
            return {
              name: comp?.label || `output_${idx}`,
              type: mapComponentToType(comp?.type || 'textbox'),
              description: comp?.info,
              component: comp?.type,
            };
          }),
          hasFileInput: (dep.inputs || []).some((idx: number) => {
            const comp = config.components[idx];
            return isFileComponent(comp?.type);
          }),
          hasFileOutput: (dep.outputs || []).some((idx: number) => {
            const comp = config.components[idx];
            return isFileComponent(comp?.type);
          }),
        };
        
        console.log('[HF Space Parser] Found endpoint:', endpoint);
        endpoints.push(endpoint);
      }
    }
  }
  
  if (endpoints.length === 0) {
    throw new Error('Space не содержит доступных эндпоинтов');
  }
  
  return {
    spaceId,
    title: config.title || spaceId,
    apiUrl,
    endpoints,
    version: config.version || '3.x',
  };
}

function isFileComponent(type: string): boolean {
  if (!type) return false;
  const lower = type.toLowerCase();
  return lower.includes('image') || lower.includes('audio') || 
         lower.includes('video') || lower.includes('file');
}

function parseGradio4Endpoint(path: string, endpoint: any): ParsedHFEndpoint {
  const parameters = (endpoint.parameters || []).map((p: any, idx: number) => 
    parseParameter(p, `param_${idx}`)
  );
  
  const returns = (endpoint.returns || []).map((r: any, idx: number) => 
    parseParameter(r, `output_${idx}`)
  );
  
  return {
    id: endpoint.id ?? 0,
    name: path.replace(/^\//, ''),
    description: endpoint.description,
    parameters,
    returns,
    hasFileInput: parameters.some((p: ParsedHFParameter) => isFileType(p.type)),
    hasFileOutput: returns.some((r: ParsedHFParameter) => isFileType(r.type)),
  };
}

function parseGradio3Endpoint(id: number, endpoint: any): ParsedHFEndpoint {
  const parameters = (endpoint.inputs || []).map((input: any, idx: number) => 
    parseParameter(input, `input_${idx}`)
  );
  
  const returns = (endpoint.outputs || []).map((output: any, idx: number) => 
    parseParameter(output, `output_${idx}`)
  );
  
  return {
    id,
    name: endpoint.api_name || `endpoint_${id}`,
    description: endpoint.description,
    parameters,
    returns,
    hasFileInput: parameters.some((p: ParsedHFParameter) => isFileType(p.type)),
    hasFileOutput: returns.some((r: ParsedHFParameter) => isFileType(r.type)),
  };
}

function parseParameter(param: any, fallbackName: string): ParsedHFParameter {
  const component = param.component || param.type || 'textbox';
  const type = mapComponentToType(component);
  
  return {
    name: param.label || param.name || fallbackName,
    type,
    description: param.info || param.description,
    optional: !param.required,
    component,
  };
}

function mapComponentToType(component: string): ParsedHFParameter['type'] {
  const lower = component.toLowerCase();
  
  if (lower.includes('image')) return 'image';
  if (lower.includes('audio')) return 'audio';
  if (lower.includes('video')) return 'video';
  if (lower.includes('file')) return 'file';
  if (lower.includes('number') || lower.includes('slider')) return 'number';
  if (lower.includes('checkbox')) return 'boolean';
  if (lower.includes('dropdown') || lower.includes('radio')) return 'string';
  if (lower.includes('textbox') || lower.includes('text')) return 'string';
  
  return 'string';
}

function isFileType(type: string): boolean {
  return ['file', 'image', 'audio', 'video'].includes(type);
}

/**
 * Конвертирует ParsedHFParameter в Gemini tool parameter schema
 */
export function toGeminiParameterType(param: ParsedHFParameter): any {
  switch (param.type) {
    case 'number':
      return { type: 'number', description: param.description };
    case 'boolean':
      return { type: 'boolean', description: param.description };
    case 'array':
      return { type: 'array', items: { type: 'string' }, description: param.description };
    case 'file':
    case 'image':
    case 'audio':
    case 'video':
      return { 
        type: 'string', 
        description: `${param.description || ''} (прикрепи файл к сообщению)`.trim() 
      };
    default:
      return { type: 'string', description: param.description };
  }
}
