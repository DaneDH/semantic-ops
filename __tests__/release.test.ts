import { describe, it, expect, vi } from 'vitest';
import { createTagAndRelease, ReleaseError } from '../src/release';

function makeOctokit(overrides: Partial<Record<string, unknown>> = {}) {
  const getRef = vi.fn().mockRejectedValue({ status: 404 });
  const createTag = vi.fn().mockResolvedValue({ data: { sha: 'tagobjectsha' } });
  const createRef = vi.fn().mockResolvedValue({});
  const createRelease = vi.fn().mockResolvedValue({
    data: { id: 42, html_url: 'https://github.com/org/repo/releases/tag/v1.0.0' },
  });

  return {
    octokit: {
      rest: {
        git: { getRef, createTag, createRef },
        repos: { createRelease },
      },
    },
    getRef,
    createTag,
    createRef,
    createRelease,
    ...overrides,
  };
}

const baseParams = {
  owner: 'org',
  repo: 'repo',
  tagName: 'v1.0.0',
  sha: 'abc123',
  version: '1.0.0',
  prerelease: false,
  branchName: 'feature/thing',
};

describe('createTagAndRelease', () => {
  it('creates the tag, ref, and Release by default', async () => {
    const { octokit, createTag, createRef, createRelease } = makeOctokit();

    const result = await createTagAndRelease(octokit as any, baseParams);

    expect(createTag).toHaveBeenCalledTimes(1);
    expect(createRef).toHaveBeenCalledTimes(1);
    expect(createRelease).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ releaseId: 42, releaseUrl: 'https://github.com/org/repo/releases/tag/v1.0.0' });
  });

  it('skips creating a Release when createRelease is false, but still creates the tag', async () => {
    const { octokit, createTag, createRef, createRelease } = makeOctokit();

    const result = await createTagAndRelease(octokit as any, { ...baseParams, createRelease: false });

    expect(createTag).toHaveBeenCalledTimes(1);
    expect(createRef).toHaveBeenCalledTimes(1);
    expect(createRelease).not.toHaveBeenCalled();
    expect(result).toEqual({ releaseId: null, releaseUrl: null });
  });

  it('leads the tag message with the tag name, then the body, then a branch_name trailer, when a body is given', async () => {
    const { octokit, createTag } = makeOctokit();

    await createTagAndRelease(octokit as any, {
      ...baseParams,
      createRelease: false,
      body: 'feat: add thing\n\nFull body here.',
    });

    expect(createTag).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'v1.0.0\n\nfeat: add thing\n\nFull body here.\n\nbranch_name: [feature/thing]',
      }),
    );
  });

  it('falls back to the tag name plus a branch_name trailer as the tag message when no body is given', async () => {
    const { octokit, createTag } = makeOctokit();

    await createTagAndRelease(octokit as any, { ...baseParams, createRelease: false });

    expect(createTag).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'v1.0.0\n\nbranch_name: [feature/thing]' }),
    );
  });

  it('never includes the branch_name trailer in the Release body', async () => {
    const { octokit, createRelease } = makeOctokit();

    await createTagAndRelease(octokit as any, { ...baseParams, body: 'feat: add thing' });

    expect(createRelease).toHaveBeenCalledWith(expect.objectContaining({ body: 'feat: add thing' }));
  });

  it('throws ReleaseError instead of overwriting an existing tag', async () => {
    const { octokit, createRelease } = makeOctokit();
    octokit.rest.git.getRef = vi.fn().mockResolvedValue({ data: {} });

    await expect(createTagAndRelease(octokit as any, baseParams)).rejects.toThrow(ReleaseError);
    expect(createRelease).not.toHaveBeenCalled();
  });
});
