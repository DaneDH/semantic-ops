import * as github from '@actions/github';

export class ReleaseError extends Error {}

type Octokit = ReturnType<typeof github.getOctokit>;

export interface CreateTagAndReleaseParams {
  owner: string;
  repo: string;
  tagName: string;
  sha: string;
  version: string;
  prerelease: boolean;
  /** Release description. Falls back to GitHub's auto-generated notes when omitted. */
  body?: string;
}

async function tagRefExists(octokit: Octokit, owner: string, repo: string, tagName: string): Promise<boolean> {
  try {
    await octokit.rest.git.getRef({ owner, repo, ref: `tags/${tagName}` });
    return true;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return false;
    throw err;
  }
}

/**
 * Creates an annotated tag + GitHub Release at the given SHA. If the tag
 * already exists this fails loudly rather than overwriting it -- a re-run
 * that recomputes the same version (e.g. no new bump-worthy commits since
 * the last push on this channel) is a signal something's wrong, not a case
 * to silently paper over.
 */
export interface CreateTagAndReleaseResult {
  releaseId: number;
  releaseUrl: string;
}

export async function createTagAndRelease(
  octokit: Octokit,
  params: CreateTagAndReleaseParams,
): Promise<CreateTagAndReleaseResult> {
  const { owner, repo, tagName, sha, version, prerelease, body } = params;

  if (await tagRefExists(octokit, owner, repo, tagName)) {
    throw new ReleaseError(
      `Tag "${tagName}" already exists. semantic-ops will not overwrite an existing tag -- ` +
        'this usually means no new bump-worthy commits have landed since the last release on this channel.',
    );
  }

  const tagObject = await octokit.rest.git.createTag({
    owner,
    repo,
    tag: tagName,
    message: tagName,
    object: sha,
    type: 'commit',
  });

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/tags/${tagName}`,
    sha: tagObject.data.sha,
  });

  const release = await octokit.rest.repos.createRelease({
    owner,
    repo,
    tag_name: tagName,
    target_commitish: sha,
    name: version,
    prerelease,
    ...(body ? { body } : { generate_release_notes: true }),
  });

  return { releaseId: release.data.id, releaseUrl: release.data.html_url };
}
