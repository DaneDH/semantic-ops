import { describe, it, expect, vi } from 'vitest';
import { findMergedPullRequestContext } from '../src/prContext';

function makeOctokit({
  pulls = [] as Array<{ number: number; head: { ref: string } }>,
  commits = [] as Array<{ commit: { message: string } }>,
} = {}) {
  const listPullRequestsAssociatedWithCommit = vi.fn().mockResolvedValue({ data: pulls });
  const listCommits = vi.fn().mockResolvedValue({ data: commits });

  return {
    octokit: {
      rest: {
        repos: { listPullRequestsAssociatedWithCommit },
        pulls: { listCommits },
      },
    },
    listPullRequestsAssociatedWithCommit,
    listCommits,
  };
}

describe('findMergedPullRequestContext', () => {
  it('returns null when no pull request is associated with the commit', async () => {
    const { octokit } = makeOctokit({ pulls: [] });
    const result = await findMergedPullRequestContext(octokit as any, 'org', 'repo', 'sha123');
    expect(result).toBeNull();
  });

  it('returns the head branch name and full original commit list when a PR is found', async () => {
    const { octokit, listCommits } = makeOctokit({
      pulls: [{ number: 42, head: { ref: 'feature/thing' } }],
      commits: [
        { commit: { message: 'feat: add x' } },
        { commit: { message: 'fix: y' } },
        { commit: { message: 'chore: z' } },
      ],
    });

    const result = await findMergedPullRequestContext(octokit as any, 'org', 'repo', 'sha123');

    expect(result).toEqual({
      branchName: 'feature/thing',
      commitMessages: ['feat: add x', 'fix: y', 'chore: z'],
    });
    expect(listCommits).toHaveBeenCalledWith({ owner: 'org', repo: 'repo', pull_number: 42 });
  });

  it('uses the first PR when multiple are associated with the commit', async () => {
    const { octokit } = makeOctokit({
      pulls: [
        { number: 1, head: { ref: 'feature/first' } },
        { number: 2, head: { ref: 'feature/second' } },
      ],
      commits: [{ commit: { message: 'feat: add x' } }],
    });

    const result = await findMergedPullRequestContext(octokit as any, 'org', 'repo', 'sha123');
    expect(result?.branchName).toBe('feature/first');
  });

  it('propagates errors from the underlying API calls for the caller to handle', async () => {
    const { octokit, listPullRequestsAssociatedWithCommit } = makeOctokit();
    listPullRequestsAssociatedWithCommit.mockRejectedValue(new Error('boom'));

    await expect(findMergedPullRequestContext(octokit as any, 'org', 'repo', 'sha123')).rejects.toThrow('boom');
  });
});
