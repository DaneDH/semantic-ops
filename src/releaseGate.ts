/**
 * Decides whether release mode should actually create a GitHub Release,
 * on top of the create_release toggle -- narrowing *which branches* are
 * allowed to release. Never affects tagging; a tag is always created
 * regardless of this gate. Uses the plain current branch name (not the
 * PR-context-resolved one) -- this is intentionally a simple, coarse gate,
 * orthogonal to the merge-strategy-agnostic bump/postfix resolution.
 */
export function shouldCreateRelease(
  branchName: string,
  createRelease: boolean,
  releaseBranchRules: string[],
): boolean {
  if (!createRelease) return false;
  if (releaseBranchRules.length === 0) return true;
  return releaseBranchRules.some((pattern) => new RegExp(pattern).test(branchName));
}
