import { describe, it, expect, vi, beforeEach } from 'vitest';

const getExecOutputMock = vi.fn();

vi.mock('@actions/exec', () => ({
  getExecOutput: (...args: unknown[]) => getExecOutputMock(...args),
}));

import { hasBranchAlreadyBeenTagged } from '../src/branchHistory';
import { GitError } from '../src/commits';

beforeEach(() => {
  getExecOutputMock.mockReset();
});

function mockGit(handlers: Record<string, { exitCode: number; stdout?: string; stderr?: string }>) {
  getExecOutputMock.mockImplementation(async (_cmd: string, args: string[]) => {
    const key = args.join(' ');
    const match = Object.entries(handlers).find(([pattern]) => key.includes(pattern));
    if (!match) throw new Error(`Unexpected git invocation in test: git ${key}`);
    const [, response] = match;
    return { exitCode: response.exitCode, stdout: response.stdout ?? '', stderr: response.stderr ?? '' };
  });
}

describe('hasBranchAlreadyBeenTagged', () => {
  it('returns false when no tag is unique to this branch (never tagged before)', async () => {
    mockGit({
      'merge-base origin/main HEAD': { exitCode: 0, stdout: 'basesha123\n' },
      'tag --merged HEAD': { exitCode: 0, stdout: 'v1.0.0\nv1.1.0\n' },
      'tag --merged basesha123': { exitCode: 0, stdout: 'v1.0.0\nv1.1.0\n' },
    });

    expect(await hasBranchAlreadyBeenTagged('main')).toBe(false);
  });

  it('returns true when a tag reachable from HEAD is not reachable from the fork point', async () => {
    mockGit({
      'merge-base origin/main HEAD': { exitCode: 0, stdout: 'basesha123\n' },
      'tag --merged HEAD': { exitCode: 0, stdout: 'v1.0.0\nv1.1.0-beta\n' },
      'tag --merged basesha123': { exitCode: 0, stdout: 'v1.0.0\n' },
    });

    expect(await hasBranchAlreadyBeenTagged('main')).toBe(true);
  });

  it('falls back to a plain local branch name if origin/<mainBranch> does not resolve', async () => {
    mockGit({
      'merge-base origin/main HEAD': { exitCode: 128, stderr: 'unknown revision' },
      'merge-base main HEAD': { exitCode: 0, stdout: 'basesha456\n' },
      'tag --merged HEAD': { exitCode: 0, stdout: '' },
      'tag --merged basesha456': { exitCode: 0, stdout: '' },
    });

    expect(await hasBranchAlreadyBeenTagged('main')).toBe(false);
  });

  it('throws a GitError when neither origin/<mainBranch> nor <mainBranch> resolve', async () => {
    mockGit({
      'merge-base origin/main HEAD': { exitCode: 128, stderr: 'unknown revision' },
      'merge-base main HEAD': { exitCode: 128, stderr: 'unknown revision' },
    });

    await expect(hasBranchAlreadyBeenTagged('main')).rejects.toThrow(GitError);
  });

  it('throws a GitError when listing merged tags fails', async () => {
    mockGit({
      'merge-base origin/main HEAD': { exitCode: 0, stdout: 'basesha123\n' },
      'tag --merged HEAD': { exitCode: 1, stderr: 'boom' },
      'tag --merged basesha123': { exitCode: 0, stdout: '' },
    });

    await expect(hasBranchAlreadyBeenTagged('main')).rejects.toThrow(GitError);
  });
});
