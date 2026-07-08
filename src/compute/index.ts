import * as core from '@actions/core';
import { loadConfig } from '../config';
import { resolvePostfix } from '../postfix';
import { findBaselineTag } from '../baseline';
import { resolveBump } from '../bump';
import { computeNextVersion } from '../version';
import { listTags, getCommitMessagesSince } from '../commits';
import { resolveRunContext } from '../github';
import { buildOutputs } from '../outputs';

async function run(): Promise<void> {
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
  });

  for (const [key, value] of Object.entries(outputs)) {
    core.setOutput(key, value);
  }
  core.info(`Computed version: ${outputs.version} (build ${outputs.build_number}, tag ${outputs.tag_name})`);
}

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
