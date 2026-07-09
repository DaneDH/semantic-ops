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
  const { branchName, sha, runId, runNumber } = resolveRunContext();

  const postfix = resolvePostfix(branchName, config);
  core.info(`Resolved branch "${branchName}" -> postfix channel "${postfix || '(none)'}"`);

  const tags = await listTags();
  const baseline = findBaselineTag(tags, postfix, config.tag_prefix);
  core.info(
    `Baseline version for this channel: ${baseline ? baseline.raw : `(none, cold start from ${config.initial_version})`}`,
  );

  const commitMessages = await getCommitMessagesSince(baseline ? `${config.tag_prefix}${baseline.raw}` : null);
  const bumpType = resolveBump(branchName, commitMessages, config);
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
  const createRelease = resolveCreateRelease(core.getInput('create_release'), config.create_release);
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
      : `Created tag ${tagName} only (create_release was false; no GitHub Release created)`,
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
