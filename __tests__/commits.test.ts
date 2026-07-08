import { describe, it, expect, vi, beforeEach } from 'vitest';

const getExecOutputMock = vi.fn();

vi.mock('@actions/exec', () => ({
  getExecOutput: (...args: unknown[]) => getExecOutputMock(...args),
}));

import { listTags, getCommitMessagesSince, GitError, COMMIT_MESSAGE_SEPARATOR } from '../src/commits';

beforeEach(() => {
  getExecOutputMock.mockReset();
});

describe('listTags', () => {
  it('parses newline-separated tag output', async () => {
    getExecOutputMock.mockResolvedValue({ exitCode: 0, stdout: 'v1.0.0\nv1.1.0\n', stderr: '' });
    expect(await listTags()).toEqual(['v1.0.0', 'v1.1.0']);
  });

  it('throws GitError when git exits non-zero', async () => {
    getExecOutputMock.mockResolvedValue({ exitCode: 128, stdout: '', stderr: 'not a git repo' });
    await expect(listTags()).rejects.toThrow(GitError);
  });
});

describe('getCommitMessagesSince', () => {
  it('uses a <tag>..HEAD range when a baseline tag is given', async () => {
    const stdout = `feat: a${COMMIT_MESSAGE_SEPARATOR}fix: b${COMMIT_MESSAGE_SEPARATOR}`;
    getExecOutputMock.mockResolvedValue({ exitCode: 0, stdout, stderr: '' });
    const messages = await getCommitMessagesSince('v1.0.0');
    expect(messages).toEqual(['feat: a', 'fix: b']);
    expect(getExecOutputMock).toHaveBeenCalledWith(
      'git',
      ['log', 'v1.0.0..HEAD', `--pretty=format:%B${COMMIT_MESSAGE_SEPARATOR}`],
      expect.anything(),
    );
  });

  it('preserves the full multi-line body of each commit, not just the subject', async () => {
    const commitA = 'feat: add thing\n\nLonger explanation of why.\nSecond body line.';
    const commitB = 'fix: bug';
    const stdout = `${commitA}${COMMIT_MESSAGE_SEPARATOR}${commitB}${COMMIT_MESSAGE_SEPARATOR}`;
    getExecOutputMock.mockResolvedValue({ exitCode: 0, stdout, stderr: '' });
    const messages = await getCommitMessagesSince('v1.0.0');
    expect(messages).toEqual([commitA, commitB]);
  });

  it('scans full history from HEAD when there is no baseline tag', async () => {
    getExecOutputMock.mockResolvedValue({ exitCode: 0, stdout: `feat: a${COMMIT_MESSAGE_SEPARATOR}`, stderr: '' });
    await getCommitMessagesSince(null);
    expect(getExecOutputMock).toHaveBeenCalledWith(
      'git',
      ['log', 'HEAD', `--pretty=format:%B${COMMIT_MESSAGE_SEPARATOR}`],
      expect.anything(),
    );
  });

  it('throws a GitError with actionable guidance on failure', async () => {
    getExecOutputMock.mockResolvedValue({ exitCode: 128, stdout: '', stderr: "unknown revision" });
    await expect(getCommitMessagesSince('v9.9.9')).rejects.toThrow(/fetch-depth: 0/);
  });
});
