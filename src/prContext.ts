import * as github from '@actions/github';

type Octokit = ReturnType<typeof github.getOctokit>;

export interface PullRequestContext {
  branchName: string;
  commitMessages: string[];
}

/**
 * Resolves the branch name and full original commit list from the pull
 * request that introduced the given commit, using GitHub's own PR<->commit
 * tracking rather than local git history. This works regardless of merge
 * strategy (merge commit, squash, or rebase) -- unlike git branches (which
 * are just movable refs with no memory of their origin once merged) or
 * squashed commit messages (which discard the original per-commit messages
 * entirely), GitHub tracks which PR produced which commit on its own,
 * independent of git.
 *
 * Returns null if no pull request is associated with the commit (e.g. a
 * direct push with no PR involved) -- callers should fall back to local
 * git-based resolution in that case.
 */
export async function findMergedPullRequestContext(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
): Promise<PullRequestContext | null> {
  const { data: pulls } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
    owner,
    repo,
    commit_sha: sha,
  });

  if (pulls.length === 0) {
    return null;
  }

  // If more than one PR is associated with this commit (rare -- e.g.
  // cherry-picks), the first result is GitHub's own best match.
  const pull = pulls[0];

  const { data: commits } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: pull.number,
  });

  return {
    branchName: pull.head.ref,
    commitMessages: commits.map((commit) => commit.commit.message),
  };
}
