import { describe, it, expect } from 'vitest';
import { buildReleaseBody } from '../src/releaseNotes';

describe('buildReleaseBody', () => {
  it('summarizes bump type (as an "update" label), channel, and previous version in one line', () => {
    const body = buildReleaseBody({
      bumpType: 'minor',
      postfix: 'alpha',
      previousVersion: '1.32.4-alpha',
      commitMessages: ['feat: add thing', 'fix: bug'],
    });

    expect(body).toContain('_Minor update — alpha channel, bumped from 1.32.4-alpha._');
    expect(body).toContain('- feat: add thing');
    expect(body).toContain('- fix: bug');
  });

  it('labels the production channel when postfix is empty', () => {
    const body = buildReleaseBody({
      bumpType: 'patch',
      postfix: '',
      previousVersion: '2.12.28',
      commitMessages: ['fix: bug'],
    });
    expect(body).toContain('_Patch update — production, bumped from 2.12.28._');
  });

  it('omits the "bumped from" clause on cold start', () => {
    const body = buildReleaseBody({
      bumpType: 'patch',
      postfix: '',
      previousVersion: '',
      commitMessages: [],
    });
    expect(body).toContain('_Patch update — production._');
    expect(body).not.toContain('bumped from');
  });

  it('notes when there are no commits since the previous release', () => {
    const body = buildReleaseBody({
      bumpType: 'patch',
      postfix: '',
      previousVersion: '2.12.28',
      commitMessages: [],
    });
    expect(body).toContain('_No commits since the previous release on this channel._');
  });

  it('renders the full multi-line body indented under the subject bullet', () => {
    const body = buildReleaseBody({
      bumpType: 'minor',
      postfix: '',
      previousVersion: '1.0.0',
      commitMessages: ['feat: add thing\n\nExplains why in more detail.\nSecond line of body.'],
    });
    expect(body).toContain('- feat: add thing');
    expect(body).toContain('  Explains why in more detail.');
    expect(body).toContain('  Second line of body.');
  });

  it('renders single-line commits as a plain bullet with no extra body', () => {
    const body = buildReleaseBody({
      bumpType: 'patch',
      postfix: '',
      previousVersion: '1.0.0',
      commitMessages: ['fix: bug'],
    });
    const lines = body.split('\n');
    const bulletIndex = lines.indexOf('- fix: bug');
    expect(bulletIndex).toBeGreaterThan(-1);
    // No indented continuation line follows a single-line (no-body) commit.
    const nextLine = lines[bulletIndex + 1];
    if (nextLine !== undefined) {
      expect(nextLine).not.toMatch(/^ {2}/);
    }
  });
});
