import { describe, it, expect } from 'vitest';
import { resolvePostfix } from '../src/postfix';
import { parseConfig } from '../src/config';

const baseConfig = parseConfig({
  main_branch: 'main',
  default_postfix: '',
  branch_postfix_rules: [
    { pattern: '^alpha/|/alpha$', postfix: 'alpha' },
    { pattern: '^beta/|/beta$', postfix: 'beta' },
  ],
});

describe('resolvePostfix', () => {
  it('returns empty string for the main branch regardless of naming', () => {
    expect(resolvePostfix('main', baseConfig)).toBe('');
  });

  it('resolves the first matching branch_postfix_rules entry', () => {
    expect(resolvePostfix('alpha/foo', baseConfig)).toBe('alpha');
    expect(resolvePostfix('feature/beta', baseConfig)).toBe('beta');
  });

  it('falls back to default_postfix when no rule matches and branch is not main', () => {
    expect(resolvePostfix('feature/unrelated', baseConfig)).toBe('');
  });

  it('respects a non-empty default_postfix fallback', () => {
    const cfg = parseConfig({ ...baseConfig, default_postfix: 'dev' });
    expect(resolvePostfix('feature/unrelated', cfg)).toBe('dev');
  });

  it('first matching rule wins when multiple rules could match', () => {
    const cfg = parseConfig({
      main_branch: 'main',
      branch_postfix_rules: [
        { pattern: 'release', postfix: 'first' },
        { pattern: 'release/alpha', postfix: 'second' },
      ],
    });
    expect(resolvePostfix('release/alpha', cfg)).toBe('first');
  });
});
