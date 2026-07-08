import { describe, it, expect } from 'vitest';
import { buildOutputs, shortSha } from '../src/outputs';

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
      commit_messages: 'feat: add thing\nfix: bug',
    });
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
