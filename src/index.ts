import * as core from '@actions/core';
import { loadConfig } from './config';
import { resolvePostfix } from './postfix';
import { findBaselineTag } from './baseline';
import { resolveBump } from './bump';
import { computeNextVersion } from './version';
import { listTags, getCommitMessagesSince, COMMIT_MESSAGE_SEPARATOR } from './commits';
import { resolveRunContext, getOctokit, repoInfo } from './github';
import { buildOutputs } from './outputs';
import { createTagAndRelease } from './release';
import { buildReleaseBody } from './releaseNotes';
import { findMergedPullRequestContext } from './prContext';
import { shouldCreateRelease } from './releaseGate';

/**
 * Resolves whether to create a GitHub Release: an explicit "true"/"false"
 * on the create_release input always wins (lets one job override the
 * config for a single run); an unset input falls back to the config
 * file's create_release field, which is the normal way to control this.
 * There is no default value for the input itself, specifically so "unset"
 * can be told apart from "explicitly false" here.
 */
export function resolveCreateRelease(rawInput: string, configValue: boolean): boolean {
  const trimmed = rawInput.trim().toLowerCase();
  if (trimmed === '') return configValue;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  throw new Error(`Invalid "create_release" input: "${rawInput}". Must be "true" or "false" (or left unset).`);
}

async function runCompute(): Promise<void> {
  const configPath = core.getInput('config_path') || 'semantic-ops.yml';

  const config = loadConfig(configPath);
  const runContext = resolveRunContext();
  const { sha, runId, runNumber } = runContext;

  // Postfix/channel is about WHERE this commit lands (the real, current
  // branch) -- it must never be affected by PR inheritance below. A PR
  // from "feature/thing" merging into "main" is still a production
  // release with no postfix, even if "feature/thing" would itself match a
  // branch_postfix_rules pattern.
  const currentBranch = runContext.branchName;
  const postfix = resolvePostfix(currentBranch, config);
  core.info(`Resolved branch "${currentBranch}" -> postfix channel "${postfix || '(none)'}"`);

  // bump_type/commit_rules, by contrast, are about WHAT changed -- so they
  // benefit from PR inheritance: if this commit was introduced by a pull
  // request, prefer its real head branch name and full original commit
  // list over local git for THIS resolution only. This is what makes
  // branch_rules/commit_rules work correctly after a PR merges into main,
  // regardless of merge strategy (merge commit, squash, or rebase all lose
  // this information locally in different ways; GitHub's own PR<->commit
  // tracking doesn't). Gracefully falls back to today's local-git
  // resolution if no token is available, no PR is associated with this
  // commit, or the lookup fails for any reason.
  let bumpBranch = currentBranch;
  let prCommitMessages: string[] | null = null;

  const token = core.getInput('github_token');
  if (token) {
    try {
      const octokit = getOctokit(token);
      const { owner, repo } = repoInfo();
      const prContext = await findMergedPullRequestContext(octokit, owner, repo, sha);
      if (prContext) {
        bumpBranch = prContext.branchName;
        prCommitMessages = prContext.commitMessages;
        core.info(
          `Resolved bump-type branch and commits from the pull request that introduced this commit: "${bumpBranch}"`,
        );
      }
    } catch (err) {
      core.warning(
        `Could not resolve the merging pull request for this commit, falling back to local branch/commit resolution: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const tags = await listTags();
  const baseline = findBaselineTag(tags, postfix, config.tag_prefix);
  core.info(
    `Baseline version for this channel: ${baseline ? baseline.raw : `(none, cold start from ${config.initial_version})`}`,
  );

  const commitMessages =
    prCommitMessages ?? (await getCommitMessagesSince(baseline ? `${config.tag_prefix}${baseline.raw}` : null));
  const bumpType = resolveBump(bumpBranch, commitMessages, config);
  core.info(`Resolved bump type: ${bumpType}`);

  const version = computeNextVersion(baseline, bumpType, postfix, config.initial_version);
  const outputs = buildOutputs({
    version,
    previousVersion: baseline ? baseline.raw : '',
    bumpType,
    postfix,
    sha,
    runId,
    runNumber,
    tagPrefix: config.tag_prefix,
    commitMessages,
    createRelease: config.create_release,
  });

  for (const [key, value] of Object.entries(outputs)) {
    core.setOutput(key, value);
  }
  core.info(`Computed version: ${outputs.version} (build ${outputs.build_number}, tag ${outputs.tag_name})`);
}

async function runRelease(): Promise<void> {
  const configPath = core.getInput('config_path') || 'semantic-ops.yml';
  const config = loadConfig(configPath);

  const tagName = core.getInput('tag_name', { required: true });
  const sha = core.getInput('sha', { required: true });
  const version = core.getInput('version', { required: true });
  const prerelease = core.getBooleanInput('prerelease');
  const { branchName } = resolveRunContext();
  const createRelease = shouldCreateRelease(
    branchName,
    resolveCreateRelease(core.getInput('create_release'), config.create_release),
    config.release_branch_rules,
  );
  const token = core.getInput('github_token', { required: true });

  const bumpType = core.getInput('bump_type');
  const postfix = core.getInput('postfix');
  const previousVersion = core.getInput('previous_version');
  const commitMessages = core
    .getInput('commit_messages')
    .split(COMMIT_MESSAGE_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  // Only build a custom body when the caller supplied enough context to make
  // one meaningful; otherwise fall back to GitHub's auto-generated notes.
  const body = bumpType
    ? buildReleaseBody({ bumpType, postfix, previousVersion, commitMessages })
    : undefined;

  const octokit = getOctokit(token);
  const { owner, repo } = repoInfo();

  const result = await createTagAndRelease(octokit, {
    owner,
    repo,
    tagName,
    sha,
    version,
    prerelease,
    body,
    createRelease,
  });

  core.setOutput('release_id', result.releaseId !== null ? String(result.releaseId) : '');
  core.setOutput('release_url', result.releaseUrl ?? '');
  core.info(
    result.releaseUrl
      ? `Created tag and release: ${tagName} (${result.releaseUrl})`
      : `Created tag ${tagName} only (create_release is false, or branch "${branchName}" doesn't match release_branch_rules; no GitHub Release created)`,
  );
}

async function run(): Promise<void> {
  const mode = core.getInput('mode', { required: true });

  if (mode === 'compute') {
    await runCompute();
  } else if (mode === 'release') {
    await runRelease();
  } else {
    throw new Error(`Invalid "mode" input: "${mode}". Must be "compute" or "release".`);
  }
}

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
