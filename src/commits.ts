import { getExecOutput } from '@actions/exec';

export class GitError extends Error {}

/**
 * Delimiter used both to split `git log` output into individual commit
 * messages and to serialize/deserialize the commit_messages GitHub Actions
 * output across the compute -> release step boundary. A control character,
 * not a substring humans type in commit messages, so multi-line commit
 * bodies never get misinterpreted as multiple commits.
 */
export const COMMIT_MESSAGE_SEPARATOR = '\x1e';

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
 * Returns full commit messages (subject + body) since baselineTag (exclusive)
 * up to HEAD. If baselineTag is null (cold start / no prior tag on this
 * channel), returns every commit message reachable from HEAD. The full body
 * is preserved (not just the subject line) so release notes built from these
 * can serve as real documentation, not just a list of one-liners.
 */
export async function getCommitMessagesSince(baselineTag: string | null): Promise<string[]> {
  const range = baselineTag ? `${baselineTag}..HEAD` : 'HEAD';
  const result = await getExecOutput(
    'git',
    ['log', range, `--pretty=format:%B${COMMIT_MESSAGE_SEPARATOR}`],
    { silent: true, ignoreReturnCode: true },
  );

  if (result.exitCode !== 0) {
    throw new GitError(
      `"git log ${range}" failed: ${result.stderr.trim()}. ` +
        'Ensure actions/checkout uses fetch-depth: 0 so the baseline tag and full commit history are available locally.',
    );
  }

  return result.stdout
    .split(COMMIT_MESSAGE_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
