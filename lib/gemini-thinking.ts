export function usesGeminiThinkingLevels(modelId: string): boolean {
  return /^(?:models\/)?gemini-[34][.-]/i.test(modelId);
}

export function getGeminiThinkingLevel(modelId: string, budget: number): 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | undefined {
  if (budget < 0 || !Number.isFinite(budget)) return undefined;

  const model = modelId.toLowerCase().replace(/^models\//, '');
  const supportsMinimal = /^gemini-3(?:-flash|\.6-flash|\.5-flash|\.1-flash-lite)(?:-|$)/.test(model);
  if (budget === 0) return supportsMinimal ? 'MINIMAL' : 'LOW';
  if (budget >= 8192 || (model.includes('flash-lite-image') && supportsMinimal)) return 'HIGH';
  if (budget >= 4096 && !model.startsWith('gemini-3-pro')) return 'MEDIUM';
  return 'LOW';
}

export function buildGeminiThinkingConfig(modelId: string, budget: unknown, includeThoughts: boolean) {
  const model = modelId.toLowerCase().replace(/^models\//, '');
  const requested = typeof budget === 'number' && Number.isFinite(budget) ? Math.trunc(budget) : -1;

  if (usesGeminiThinkingLevels(model)) {
    const thinkingLevel = getGeminiThinkingLevel(model, requested);
    return { includeThoughts, ...(thinkingLevel ? { thinkingLevel } : {}) };
  }

  if (/^gemini-2\.5-(?:flash|pro)(?:-|$)/.test(model)) {
    const isPro = model.startsWith('gemini-2.5-pro');
    const minimum = isPro ? 128 : model.startsWith('gemini-2.5-flash-lite') && requested > 0 ? 512 : 0;
    const maximum = isPro ? 32768 : 24576;
    const thinkingBudget = requested < 0 ? -1 : Math.min(maximum, Math.max(minimum, requested));
    return { includeThoughts: includeThoughts && thinkingBudget !== 0, thinkingBudget };
  }

  if (model.includes('thinking')) return { includeThoughts };
  return undefined;
}
