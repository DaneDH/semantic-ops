import * as core from '@actions/core';
import { getOctokit, repoInfo } from '../github';
import { createTagAndRelease } from '../release';
import { buildReleaseBody } from '../releaseNotes';

async function run(): Promise<void> {
  const tagName = core.getInput('tag_name', { required: true });
  const sha = core.getInput('sha', { required: true });
  const version = core.getInput('version', { required: true });
  const prerelease = core.getBooleanInput('prerelease');
  const token = core.getInput('github_token', { required: true });

  const bumpType = core.getInput('bump_type');
  const postfix = core.getInput('postfix');
  const previousVersion = core.getInput('previous_version');
  const commitMessages = core
    .getInput('commit_messages')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

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
  });

  core.setOutput('release_id', String(result.releaseId));
  core.setOutput('release_url', result.releaseUrl);
  core.info(`Created tag and release: ${tagName} (${result.releaseUrl})`);
}

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
