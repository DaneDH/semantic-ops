import { describe, it, expect } from 'vitest';
import { resolveBump, matchCommitRules, matchBranchRules } from '../src/bump';
import { parseConfig } from '../src/config';

const commitRules = {
  major: ['^BREAKING CHANGE', '!:'],
  minor: ['^feat(\\(.+\\))?:', '^feature/'],
  patch: ['^fix(\\(.+\\))?:'],
};

const branchRules = {
  major: ['^release/major/'],
  minor: [],
  patch: ['^hotfix/', '^bugfix/'],
};

function config(precedence: 'branch-first' | 'commit-first') {
  return parseConfig({
    default_bump: 'patch',
    precedence,
    branch_rules: branchRules,
    commit_rules: commitRules,
  });
}

describe('matchBranchRules', () => {
  it('matches any pattern within a level, not just the first', () => {
    expect(matchBranchRules('bugfix/thing', branchRules)).toBe('patch');
    expect(matchBranchRules('hotfix/thing', branchRules)).toBe('patch');
  });

  it('returns null when nothing matches', () => {
    expect(matchBranchRules('feature/thing', branchRules)).toBeNull();
  });
});

describe('matchCommitRules', () => {
  it('returns the highest-severity level with any matching commit', () => {
    const messages = ['fix: small bug', 'feat: add thing', 'chore: unrelated'];
    expect(matchCommitRules(messages, commitRules)).toBe('minor');
  });

  it('major beats minor and patch even if it appears last', () => {
    const messages = ['fix: small bug', 'feat: add thing', 'feat!: breaking change'];
    expect(matchCommitRules(messages, commitRules)).toBe('major');
  });

  it('matches any pattern within a level (multiple patterns per bump)', () => {
    expect(matchCommitRules(['feature/x: add thing'], commitRules)).toBe('minor');
  });

  it('returns null when nothing matches', () => {
    expect(matchCommitRules(['chore: unrelated'], commitRules)).toBeNull();
  });

  it('only matches against the subject line, ignoring the commit body', () => {
    const messages = ['chore: unrelated\n\nThis paragraph happens to mention fix: in prose, not as a type.'];
    expect(matchCommitRules(messages, commitRules)).toBeNull();
  });

  it('still matches when the subject line itself qualifies, regardless of body content', () => {
    const messages = ['fix: real bug\n\nSome unrelated body text about feat: something else entirely.'];
    expect(matchCommitRules(messages, commitRules)).toBe('patch');
  });
});

describe('resolveBump', () => {
  it('uses the branch signal when only branch matches', () => {
    const cfg = config('commit-first');
    expect(resolveBump('hotfix/foo', ['chore: nothing'], cfg)).toBe('patch');
  });

  it('uses the commit signal when only commit matches', () => {
    const cfg = config('branch-first');
    expect(resolveBump('feature/foo', ['feat: add thing'], cfg)).toBe('minor');
  });

  it('agrees when both signals match the same bump', () => {
    const cfg = config('commit-first');
    expect(resolveBump('hotfix/foo', ['fix: bug'], cfg)).toBe('patch');
  });

  it('commit-first precedence wins on conflict', () => {
    const cfg = config('commit-first');
    expect(resolveBump('release/major/foo', ['fix: bug'], cfg)).toBe('patch');
  });

  it('branch-first precedence wins on conflict', () => {
    const cfg = config('branch-first');
    expect(resolveBump('release/major/foo', ['fix: bug'], cfg)).toBe('major');
  });

  it('falls back to default_bump when neither signal matches', () => {
    const cfg = config('commit-first');
    expect(resolveBump('feature/foo', ['chore: nothing'], cfg)).toBe('patch');
  });
});
