import { getExecOutput } from '@actions/exec';
import { GitError } from './commits';

async function findMergeBase(mainBranch: string): Promise<string> {
  // Prefer the remote-tracking ref (present after actions/checkout with
  // fetch-depth: 0); fall back to a plain local branch name for local/dry-run
  // use where there may be no "origin" remote at all.
  for (const ref of [`origin/${mainBranch}`, mainBranch]) {
    const result = await getExecOutput('git', ['merge-base', ref, 'HEAD'], {
      silent: true,
      ignoreReturnCode: true,
    });
    if (result.exitCode === 0) {
      return result.stdout.trim();
    }
  }

  throw new GitError(
    `Could not find a merge base between "${mainBranch}" and HEAD. ` +
      'Ensure actions/checkout uses fetch-depth: 0 so main_branch\'s full history is available locally.',
  );
}

async function tagsMergedInto(ref: string): Promise<Set<string>> {
  const result = await getExecOutput('git', ['tag', '--merged', ref], {
    silent: true,
    ignoreReturnCode: true,
  });
  if (result.exitCode !== 0) {
    throw new GitError(`"git tag --merged ${ref}" failed: ${result.stderr.trim()}`);
  }
  return new Set(
    result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );
}

/**
 * Whether this branch has ever produced a tag of its own -- not whether the
 * branch ref itself is "new". Those two differ exactly when a branch's first
 * push succeeds through compute but a later step (typecheck/test/build/
 * release) fails before a tag is created: the branch ref already exists on
 * retry, but no tag has ever actually been made for it. Answered by finding
 * where this branch forked from main_branch, then checking whether any tag
 * reachable from HEAD is NOT also reachable from that fork point -- i.e. a
 * tag created specifically on this branch's own history, not one that
 * already existed on main before this branch diverged.
 */
export async function hasBranchAlreadyBeenTagged(mainBranch: string): Promise<boolean> {
  const mergeBase = await findMergeBase(mainBranch);
  const [tagsAtHead, tagsAtMergeBase] = await Promise.all([
    tagsMergedInto('HEAD'),
    tagsMergedInto(mergeBase),
  ]);

  for (const tag of tagsAtHead) {
    if (!tagsAtMergeBase.has(tag)) return true;
  }
  return false;
}
