import { describe, expect, it } from 'vitest';
import { applyEdits, applyLineReplace } from './diff-engine.ts';

const sample = ['autoJump:false', 'volume:50', 'lang:ru'].join('\n');

describe('diff engine', () => {
  it('applies an exact replacement and preserves other lines', () => {
    const { result, applied, failed } = applyEdits(sample, [
      { search: 'autoJump:false', replace: 'autoJump:true' },
    ]);

    expect(applied).toBe(1);
    expect(failed).toHaveLength(0);
    expect(result).toContain('autoJump:true');
    expect(result).toContain('volume:50');
  });

  it('replaces a single line', () => {
    const result = applyLineReplace(sample, 1, 1, 'autoJump:true');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.result).toMatch(/^autoJump:true/);
  });

  it('replaces an inclusive line range', () => {
    expect(applyLineReplace(sample, 2, 3, 'volume:100\nlang:en')).toEqual({
      ok: true,
      result: 'autoJump:false\nvolume:100\nlang:en',
    });
  });

  it('tracks a failed search', () => {
    const { applied, failed } = applyEdits(sample, [
      { search: 'does-not-exist', replace: 'x' },
    ]);

    expect(applied).toBe(0);
    expect(failed).toHaveLength(1);
  });
});
