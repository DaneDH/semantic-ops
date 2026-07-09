import { describe, it, expect } from 'vitest';
import { resolveCreateRelease } from '../src/index';

describe('resolveCreateRelease', () => {
  it('falls back to the config value when the input is unset', () => {
    expect(resolveCreateRelease('', true)).toBe(true);
    expect(resolveCreateRelease('', false)).toBe(false);
  });

  it('falls back to the config value when the input is only whitespace', () => {
    expect(resolveCreateRelease('   ', false)).toBe(false);
  });

  it('an explicit "true" input overrides a false config value', () => {
    expect(resolveCreateRelease('true', false)).toBe(true);
  });

  it('an explicit "false" input overrides a true config value', () => {
    expect(resolveCreateRelease('false', true)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(resolveCreateRelease('TRUE', false)).toBe(true);
    expect(resolveCreateRelease('False', true)).toBe(false);
  });

  it('throws a clear error for an invalid value', () => {
    expect(() => resolveCreateRelease('yes', true)).toThrow(/Invalid "create_release" input/);
  });
});
