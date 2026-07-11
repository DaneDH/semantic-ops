import { describe, it, expect } from 'vitest';
import { shouldCreateRelease } from '../src/releaseGate';

describe('shouldCreateRelease', () => {
  it('always blocks when create_release is false, regardless of rules', () => {
    expect(shouldCreateRelease('main', false, [])).toBe(false);
    expect(shouldCreateRelease('main', false, ['^main$'])).toBe(false);
  });

  it('allows any branch when release_branch_rules is empty (no restriction)', () => {
    expect(shouldCreateRelease('main', true, [])).toBe(true);
    expect(shouldCreateRelease('feature/x', true, [])).toBe(true);
  });

  it('allows a branch that matches one of the rules', () => {
    expect(shouldCreateRelease('main', true, ['^main$', '^release/'])).toBe(true);
    expect(shouldCreateRelease('release/2.0', true, ['^main$', '^release/'])).toBe(true);
  });

  it('blocks a branch that matches none of the rules, even when create_release is true', () => {
    expect(shouldCreateRelease('beta/experiment', true, ['^main$', '^release/'])).toBe(false);
  });
});
