import { getExecOutput } from '@actions/exec';

export class GitError extends Error {}

/**
 * Lists all local tags. Requires the checkout step to have fetched tags
 * (e.g. actions/checkout with fetch-depth: 0), documented as a precondition.
 */
export async function listTags(): Promise<string[]> {
  const result = await getExecOutput('git', ['tag', '-l'], { silent: true, ignoreReturnCode: true });
  if (result.exitCode !== 0) {
    throw new GitError(`"git tag -l" failed: ${result.stderr.trim()}`);
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Returns commit subject lines since baselineTag (exclusive) up to HEAD.
 * If baselineTag is null (cold start / no prior tag on this channel), returns
 * every commit message reachable from HEAD.
 */
export async function getCommitMessagesSince(baselineTag: string | null): Promise<string[]> {
  const range = baselineTag ? `${baselineTag}..HEAD` : 'HEAD';
  const result = await getExecOutput('git', ['log', range, '--pretty=%s'], {
    silent: true,
    ignoreReturnCode: true,
  });

  if (result.exitCode !== 0) {
    throw new GitError(
      `"git log ${range}" failed: ${result.stderr.trim()}. ` +
        'Ensure actions/checkout uses fetch-depth: 0 so the baseline tag and full commit history are available locally.',
    );
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
