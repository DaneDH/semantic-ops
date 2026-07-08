import { describe, it, expect } from 'vitest';
import { buildReleaseBody } from '../src/releaseNotes';

describe('buildReleaseBody', () => {
  it('includes bump type, channel, previous version, and commit list', () => {
    const body = buildReleaseBody({
      bumpType: 'minor',
      postfix: 'alpha',
      previousVersion: '1.32.4-alpha',
      commitMessages: ['feat: add thing', 'fix: bug'],
    });

    expect(body).toContain('**Bump type:** minor');
    expect(body).toContain('**Channel:** alpha');
    expect(body).toContain('**Previous version:** 1.32.4-alpha');
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
    expect(body).toContain('**Channel:** production (no postfix)');
  });

  it('omits the previous version line on cold start', () => {
    const body = buildReleaseBody({
      bumpType: 'patch',
      postfix: '',
      previousVersion: '',
      commitMessages: [],
    });
    expect(body).not.toContain('Previous version');
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
