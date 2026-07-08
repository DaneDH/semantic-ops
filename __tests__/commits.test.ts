import { describe, it, expect, vi, beforeEach } from 'vitest';

const getExecOutputMock = vi.fn();

vi.mock('@actions/exec', () => ({
  getExecOutput: (...args: unknown[]) => getExecOutputMock(...args),
}));

import { listTags, getCommitMessagesSince, GitError } from '../src/commits';

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
    getExecOutputMock.mockResolvedValue({ exitCode: 0, stdout: 'feat: a\nfix: b\n', stderr: '' });
    const messages = await getCommitMessagesSince('v1.0.0');
    expect(messages).toEqual(['feat: a', 'fix: b']);
    expect(getExecOutputMock).toHaveBeenCalledWith(
      'git',
      ['log', 'v1.0.0..HEAD', '--pretty=%s'],
      expect.anything(),
    );
  });

  it('scans full history from HEAD when there is no baseline tag', async () => {
    getExecOutputMock.mockResolvedValue({ exitCode: 0, stdout: 'feat: a\n', stderr: '' });
    await getCommitMessagesSince(null);
    expect(getExecOutputMock).toHaveBeenCalledWith('git', ['log', 'HEAD', '--pretty=%s'], expect.anything());
  });

  it('throws a GitError with actionable guidance on failure', async () => {
    getExecOutputMock.mockResolvedValue({ exitCode: 128, stdout: '', stderr: "unknown revision" });
    await expect(getCommitMessagesSince('v9.9.9')).rejects.toThrow(/fetch-depth: 0/);
  });
});
