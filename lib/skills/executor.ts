import type { Message, SkillArtifact } from '@/types';
import type {
  Skill,
  SkillContext,
  SkillUIEvent,
  SkillExecutionResult,
  GeminiToolDeclaration,
  AttachedFileRef,
} from './types';
import { isSkillActive, getSkillConfig, createSkillStorage, getSkillCustomization } from './registry';
import { BUILT_IN_SKILLS } from './built-in';
import { loadFileData } from '@/lib/fileStorage';
import { loadHFSpaceSkills } from './hf-space';

// ─────────────────────────────────────────────────────────────────────────────
// Skill catalog — все доступные скиллы (встроенные + кастомные + HF Spaces)
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_CATALOG = new Map<string, Skill>(
  BUILT_IN_SKILLS.map(s => [s.id, s])
);

// Загружаем HF Space скиллы из localStorage и регистрируем
export function reloadHFSpaceSkills(): void {
  // Удаляем старые HF skills из каталога
  for (const [id] of Array.from(SKILL_CATALOG)) {
    if (id.startsWith('hf_')) SKILL_CATALOG.delete(id);
  }
  
  // Загружаем актуальные
  for (const skill of loadHFSpaceSkills()) {
    SKILL_CATALOG.set(skill.id, skill);
  }
}

// Вызываем при инициализации
reloadHFSpaceSkills();

export function getSkillCatalog(): Skill[] {
  return Array.from(SKILL_CATALOG.values());
}

export function getSkillById(id: string): Skill | undefined {
  return SKILL_CATALOG.get(id);
}

/** Зарегистрировать кастомный скилл (для будущего community marketplace) */
export function registerSkill(skill: Skill): void {
  SKILL_CATALOG.set(skill.id, skill);
}

// ─────────────────────────────────────────────────────────────────────────────
// Context factory
// ─────────────────────────────────────────────────────────────────────────────

function createContext(
  skill: Skill,
  chatId: string,
  messages: Message[],
  emitter: (event: SkillUIEvent) => void
): SkillContext {
  // Находим последнее user сообщение для attachedFiles
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  
  const attachedFiles: AttachedFileRef[] = (lastUserMsg?.files ?? []).map(file => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    getData: async () => {
      // Если data уже в памяти — возвращаем
      if (file.data) return file.data;
      // Иначе загружаем из IndexedDB
      const data = await loadFileData(file.id);
      return data ?? '';
    },
    getBlob: async () => {
      const base64 = file.data || await loadFileData(file.id) || '';
      const bytes = atob(base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      return new Blob([arr], { type: file.mimeType });
    }
  }));

  // Создаем маппинг ID изображений для прямого доступа
  const imageAliases = createImageAliases(messages);

  return {
    chatId,
    messages,
    attachedFiles,
    config: getSkillConfig(skill.id),
    storage: createSkillStorage(skill.id, chatId),
    emit: emitter,
    imageAliases,
  };
}

/** Создаёт алиасы для изображений (теперь ID → ID маппинг для обратной совместимости) */
function createImageAliases(messages: Message[]): Map<string, string> {
  const aliases = new Map<string, string>();
  
  messages
    .filter(m => m.role === 'user' && m.files && m.files.length > 0)
    .forEach(m => {
      m.files!
        .filter(f => f.mimeType.startsWith('image/'))
        .forEach(f => {
          // Маппинг ID → ID (для прямого доступа)
          aliases.set(f.id, f.id);
        });
    });
  
  return aliases;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool ownership — какой скилл владеет этим tool name?
// ─────────────────────────────────────────────────────────────────────────────

/** Ищем активный скилл у которого есть tool с таким именем */
export function findSkillByToolName(toolName: string): Skill | null {
  for (const skill of Array.from(SKILL_CATALOG.values())) {
    if (!isSkillActive(skill.id)) continue;
    if (skill.tools.some((t: any) => t.name === toolName)) {
      return skill;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main executor — вызывается из page.tsx когда приходит functionCall
// ─────────────────────────────────────────────────────────────────────────────

export async function executeSkillToolCall(
  toolName: string,
  args: Record<string, unknown>,
  chatId: string,
  messages: Message[],
  onUIEvent: (event: SkillUIEvent) => void
): Promise<SkillExecutionResult> {
  const skill = findSkillByToolName(toolName);

  if (!skill) {
    return { functionResponse: null, uiEvents: [], artifacts: [] };
  }

  const uiEvents: SkillUIEvent[] = [];
  const emitter = (event: SkillUIEvent) => {
    uiEvents.push(event);
    onUIEvent(event); // live emit для реактивного UI
  };

  const ctx = createContext(skill, chatId, messages, emitter);

  try {
    const result = await skill.onToolCall(toolName, args, ctx);

    // Обрабатываем артефакты
    const artifacts = await processArtifacts(result.artifacts ?? [], skill.id);

    return {
      functionResponse: result.mode === 'respond' ? result.response ?? null : null,
      responseParts: result.responseParts,
      uiEvents,
      artifacts,
    };
  } catch (err) {
    console.error(`[Skill ${skill.id}] Tool call error:`, err);
    emitter({
      type: 'toast',
      message: `Скилл "${skill.name}" вернул ошибку`,
      variant: 'error',
    });
    // Всегда возвращаем что-то чтобы не сломать flow
    return {
      functionResponse: { error: String(err) },
      uiEvents,
      artifacts: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact processing — конвертация blob → base64, генерация ID
// ─────────────────────────────────────────────────────────────────────────────

async function processArtifacts(
  artifacts: SkillArtifact[],
  skillId: string
): Promise<SkillArtifact[]> {
  const processed: SkillArtifact[] = [];

  for (const artifact of artifacts) {
    // Генерируем ID если нет
    const id = artifact.id || `artifact_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // Конвертируем blob в base64 если нужно
    let data = artifact.data;
    if (data.kind === 'blob') {
      const base64 = await blobToBase64(data.blob);
      data = { kind: 'base64', mimeType: data.mimeType, base64 };
    }

    processed.push({
      ...artifact,
      id,
      data,
      skillId,
    });
  }

  return processed;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Убираем data:...;base64, префикс
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt builder — собирает инжекции от всех активных скиллов
// ─────────────────────────────────────────────────────────────────────────────

export function buildSkillsSystemPrompt(
  chatId: string,
  messages: Message[],
  onUIEvent: (event: SkillUIEvent) => void
): string {
  const parts: string[] = [];

  for (const skill of Array.from(SKILL_CATALOG.values())) {
    if (!isSkillActive(skill.id)) continue;

    const ctx = createContext(skill, chatId, messages, onUIEvent);
    const customization = getSkillCustomization(skill.id);

    try {
      // Используем кастомный системный промпт если есть
      if (customization?.customSystemPrompt?.trim()) {
        parts.push(`\n\n[${skill.name}]\n${customization.customSystemPrompt.trim()}`);
      } 
      // Иначе вызываем onSystemPrompt если есть
      else if (skill.onSystemPrompt) {
        const injection = skill.onSystemPrompt(ctx);
        if (injection?.trim()) {
          parts.push(`\n\n[${skill.name}]\n${injection.trim()}`);
        }
      }
    } catch (err) {
      console.error(`[Skill ${skill.id}] onSystemPrompt error:`, err);
    }
  }

  return parts.join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Tools collector — все tool declarations активных скиллов
// ─────────────────────────────────────────────────────────────────────────────

export function collectSkillTools(): GeminiToolDeclaration[] {
  const declarations: GeminiToolDeclaration[] = [];
  for (const skill of Array.from(SKILL_CATALOG.values())) {
    if (!isSkillActive(skill.id)) continue;
    
    const customization = getSkillCustomization(skill.id);
    
    // Применяем кастомные описания инструментов если есть
    const tools = skill.tools.map(tool => {
      const customDesc = customization?.customToolDescriptions?.[tool.name];
      if (customDesc?.trim()) {
        return { ...tool, description: customDesc };
      }
      return tool;
    });
    
    declarations.push(...tools);
  }
  return declarations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Message complete hook — вызывается после каждого ответа модели
// ─────────────────────────────────────────────────────────────────────────────

export async function notifySkillsMessageComplete(
  message: Message,
  chatId: string,
  messages: Message[],
  onUIEvent: (event: SkillUIEvent) => void
): Promise<SkillArtifact[]> {
  console.log('[executor] notifySkillsMessageComplete called', { 
    messageId: message.id, 
    role: message.role,
    partsCount: message.parts.length 
  });
  
  const allArtifacts: SkillArtifact[] = [];
  
  for (const skill of Array.from(SKILL_CATALOG.values())) {
    if (!isSkillActive(skill.id)) continue;
    if (!skill.onMessageComplete) continue;

    console.log(`[executor] calling onMessageComplete for skill: ${skill.id}`);
    
    const ctx = createContext(skill, chatId, messages, onUIEvent);
    try {
      const result = await skill.onMessageComplete(message, ctx);
      if (result && Array.isArray(result) && result.length > 0) {
        console.log(`[executor] skill ${skill.id} returned ${result.length} artifacts`);
        const processed = await processArtifacts(result, skill.id);
        allArtifacts.push(...processed);
      } else {
        console.log(`[executor] skill ${skill.id} returned no artifacts`);
      }
    } catch (err) {
      console.error(`[Skill ${skill.id}] onMessageComplete error:`, err);
    }
  }
  
  console.log(`[executor] total artifacts collected: ${allArtifacts.length}`);
  return allArtifacts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Install/Uninstall hooks
// ─────────────────────────────────────────────────────────────────────────────

export function callSkillInstallHook(
  skillId: string,
  chatId: string,
  messages: Message[],
  onUIEvent: (event: SkillUIEvent) => void
): void {
  const skill = getSkillById(skillId);
  if (!skill?.onInstall) return;
  const ctx = createContext(skill, chatId, messages, onUIEvent);
  try { skill.onInstall(ctx); } catch (err) {
    console.error(`[Skill ${skillId}] onInstall error:`, err);
  }
}

export function callSkillUninstallHook(
  skillId: string,
  chatId: string,
  messages: Message[],
  onUIEvent: (event: SkillUIEvent) => void
): void {
  const skill = getSkillById(skillId);
  if (!skill?.onUninstall) return;
  const ctx = createContext(skill, chatId, messages, onUIEvent);
  try { skill.onUninstall(ctx); } catch (err) {
    console.error(`[Skill ${skillId}] onUninstall error:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Утилита: это tool call скилла?
// ─────────────────────────────────────────────────────────────────────────────

export function isSkillToolCall(toolName: string): boolean {
  return findSkillByToolName(toolName) !== null;
}
