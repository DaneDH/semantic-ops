import { describe, it, expect } from 'vitest';
import { buildOutputs, shortSha } from '../src/outputs';
import { COMMIT_MESSAGE_SEPARATOR } from '../src/commits';

describe('shortSha', () => {
  it('defaults to a 7-character short SHA', () => {
    expect(shortSha('8edwfac2abcdef1234567890')).toBe('8edwfac');
  });
});

describe('buildOutputs', () => {
  it('assembles all fields, including tag_name from tag_prefix + version', () => {
    const outputs = buildOutputs({
      version: '1.33.0-alpha',
      previousVersion: '1.32.4-alpha',
      bumpType: 'minor',
      postfix: 'alpha',
      sha: '8edwfac2abcdef1234567890',
      runId: 123456789,
      runNumber: 102,
      tagPrefix: 'v',
      commitMessages: ['feat: add thing', 'fix: bug'],
    });

    expect(outputs).toEqual({
      version: '1.33.0-alpha',
      previous_version: '1.32.4-alpha',
      bump_type: 'minor',
      postfix: 'alpha',
      build_number: '102.8edwfac',
      run_id: '123456789',
      sha: '8edwfac2abcdef1234567890',
      tag_name: 'v1.33.0-alpha',
      commit_messages: `feat: add thing${COMMIT_MESSAGE_SEPARATOR}fix: bug`,
    });
  });

  it('preserves embedded newlines within a single multi-line commit message', () => {
    const outputs = buildOutputs({
      version: '1.0.0',
      previousVersion: '',
      bumpType: 'minor',
      postfix: '',
      sha: 'abc1234567890',
      runId: 1,
      runNumber: 1,
      tagPrefix: 'v',
      commitMessages: ['feat: add thing\n\nWith a body line.', 'fix: bug'],
    });
    expect(outputs.commit_messages).toBe(
      `feat: add thing\n\nWith a body line.${COMMIT_MESSAGE_SEPARATOR}fix: bug`,
    );
    expect(outputs.commit_messages.split(COMMIT_MESSAGE_SEPARATOR)).toEqual([
      'feat: add thing\n\nWith a body line.',
      'fix: bug',
    ]);
  });

  it('supports an empty tag_prefix and no commit messages', () => {
    const outputs = buildOutputs({
      version: '2.12.29',
      previousVersion: '2.12.28',
      bumpType: 'patch',
      postfix: '',
      sha: '1234567890abcdef',
      runId: 1,
      runNumber: 1,
      tagPrefix: '',
      commitMessages: [],
    });
    expect(outputs.tag_name).toBe('2.12.29');
    expect(outputs.commit_messages).toBe('');
  });
});
