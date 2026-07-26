import * as github from '@actions/github';

const ZERO_SHA = '0000000000000000000000000000000000000000';

export interface RunContext {
  branchName: string;
  sha: string;
  runId: number;
  runNumber: number;
  /**
   * True when this push event is the one that created the branch (i.e. the
   * branch didn't exist in the remote before this push). Derived from the
   * push event payload's own `created`/`before` fields -- no extra API
   * calls needed.
   */
  isNewBranch: boolean;
}

export function resolveRunContext(): RunContext {
  const { context } = github;

  // For pull_request events, context.ref points at refs/pull/N/merge -- the
  // actual source branch name is in head_ref (only set on pull_request events).
  const headRef = process.env.GITHUB_HEAD_REF;
  const branchName = headRef && headRef.length > 0
    ? headRef
    : context.ref.replace(/^refs\/heads\//, '');

  const payload = context.payload as { created?: boolean; before?: string };
  const isNewBranch = payload.created === true || payload.before === ZERO_SHA;

  return {
    branchName,
    sha: context.sha,
    runId: context.runId,
    runNumber: context.runNumber,
    isNewBranch,
  };
}

export function getOctokit(token: string) {
  return github.getOctokit(token);
}

export function repoInfo() {
  return github.context.repo;
}
