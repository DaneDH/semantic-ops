import * as github from '@actions/github';

export interface RunContext {
  branchName: string;
  sha: string;
  runId: number;
  runNumber: number;
}

export function resolveRunContext(): RunContext {
  const { context } = github;

  // For pull_request events, context.ref points at refs/pull/N/merge -- the
  // actual source branch name is in head_ref (only set on pull_request events).
  const headRef = process.env.GITHUB_HEAD_REF;
  const branchName = headRef && headRef.length > 0
    ? headRef
    : context.ref.replace(/^refs\/heads\//, '');

  return {
    branchName,
    sha: context.sha,
    runId: context.runId,
    runNumber: context.runNumber,
  };
}

export function getOctokit(token: string) {
  return github.getOctokit(token);
}

export function repoInfo() {
  return github.context.repo;
}
