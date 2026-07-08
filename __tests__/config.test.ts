import { describe, it, expect } from 'vitest';
import { parseConfig, ConfigError } from '../src/config';

describe('parseConfig', () => {
  it('applies defaults for an empty config', () => {
    const cfg = parseConfig({});
    expect(cfg.main_branch).toBe('main');
    expect(cfg.tag_prefix).toBe('v');
    expect(cfg.default_bump).toBe('patch');
    expect(cfg.precedence).toBe('commit-first');
    expect(cfg.default_postfix).toBe('');
    expect(cfg.initial_version).toBe('1.0.0');
    expect(cfg.branch_rules).toEqual({ major: [], minor: [], patch: [] });
    expect(cfg.commit_rules).toEqual({ major: [], minor: [], patch: [] });
    expect(cfg.branch_postfix_rules).toEqual([]);
  });

  it('parses a fully specified valid config with multiple patterns per bump level', () => {
    const cfg = parseConfig({
      main_branch: 'main',
      tag_prefix: 'v',
      default_bump: 'patch',
      precedence: 'branch-first',
      default_postfix: '',
      branch_rules: { patch: ['^hotfix/', '^bugfix/'], minor: [], major: ['^release/major/'] },
      commit_rules: { minor: ['^feat:', '^feature/'], major: [], patch: ['^fix:'] },
      branch_postfix_rules: [{ pattern: '^alpha/', postfix: 'alpha' }],
    });
    expect(cfg.branch_rules.patch).toEqual(['^hotfix/', '^bugfix/']);
    expect(cfg.commit_rules.minor).toEqual(['^feat:', '^feature/']);
    expect(cfg.branch_postfix_rules[0].postfix).toBe('alpha');
  });

  it('rejects an invalid bump enum value', () => {
    expect(() => parseConfig({ default_bump: 'huge' })).toThrow(ConfigError);
  });

  it('rejects an invalid regular expression in branch_rules', () => {
    expect(() =>
      parseConfig({ branch_rules: { patch: ['(unclosed'] } }),
    ).toThrow(/not a valid regular expression/);
  });

  it('rejects an invalid precedence value', () => {
    expect(() => parseConfig({ precedence: 'sideways' })).toThrow(ConfigError);
  });

  it('accepts a custom initial_version', () => {
    const cfg = parseConfig({ initial_version: '2.5.0' });
    expect(cfg.initial_version).toBe('2.5.0');
  });

  it('rejects an initial_version that is not a plain semver release', () => {
    expect(() => parseConfig({ initial_version: 'not-a-version' })).toThrow(ConfigError);
    expect(() => parseConfig({ initial_version: '1.0.0-alpha' })).toThrow(
      /no prerelease/,
    );
  });
});
