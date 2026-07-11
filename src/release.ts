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
  /**
   * Whether to create the GitHub Release alongside the tag. Defaults to
   * true. Set false to tag only, leaving the Release itself to be created
   * manually -- e.g. so a human can check "Publish this Action to the
   * GitHub Marketplace" on an as-yet-unreleased tag (that checkbox isn't
   * available once a tag already has an automated Release attached).
   */
  createRelease?: boolean;
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
 * Creates an annotated tag (and, unless createRelease is false, a GitHub
 * Release) at the given SHA. If the tag already exists this fails loudly
 * rather than overwriting it -- a re-run that recomputes the same version
 * (e.g. no new bump-worthy commits since the last push on this channel) is
 * a signal something's wrong, not a case to silently paper over.
 */
export interface CreateTagAndReleaseResult {
  releaseId: number | null;
  releaseUrl: string | null;
}

export async function createTagAndRelease(
  octokit: Octokit,
  params: CreateTagAndReleaseParams,
): Promise<CreateTagAndReleaseResult> {
  const { owner, repo, tagName, sha, version, prerelease, body, createRelease = true } = params;

  if (await tagRefExists(octokit, owner, repo, tagName)) {
    throw new ReleaseError(
      `Tag "${tagName}" already exists. semantic-ops will not overwrite an existing tag -- ` +
        'this usually means no new update-worthy commits have landed since the last release on this channel.',
    );
  }

  const tagObject = await octokit.rest.git.createTag({
    owner,
    repo,
    tag: tagName,
    // GitHub's bare-tag view (no Release attached) renders its heading as
    // "{tag}: {first line of message}" UNLESS the message's first line is
    // exactly the tag name, in which case it shows the tag name alone with
    // no smushed suffix. So the tag name always goes first, on its own
    // line, with the real release notes following after a blank line --
    // giving a clean heading AND full detail below, even with no Release
    // object (which matters most when create_release is false, since the
    // tag is the only place this content can live at all).
    message: body ? `${tagName}\n\n${body}` : tagName,
    object: sha,
    type: 'commit',
  });

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/tags/${tagName}`,
    sha: tagObject.data.sha,
  });

  if (!createRelease) {
    return { releaseId: null, releaseUrl: null };
  }

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
