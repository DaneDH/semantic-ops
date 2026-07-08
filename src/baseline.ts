import * as semver from 'semver';

export interface Baseline {
  raw: string; // e.g. "1.32.4-alpha" (tag_prefix already stripped)
  version: semver.SemVer;
}

function stripPrefix(tag: string, tagPrefix: string): string | null {
  if (tagPrefix && !tag.startsWith(tagPrefix)) return null;
  return tagPrefix ? tag.slice(tagPrefix.length) : tag;
}

function channelOf(v: semver.SemVer): string {
  const pre = v.prerelease;
  return pre.length > 0 ? String(pre[0]) : '';
}

/**
 * Finds the latest tag scoped to the given postfix channel. Tags belonging to
 * a different channel (or a differently-shaped/invalid version) are ignored
 * entirely -- channel filtering happens BEFORE sorting, since semver defines
 * prerelease versions as lower precedence than their release counterpart,
 * which would otherwise corrupt cross-channel comparisons.
 */
export function findBaselineTag(
  tags: string[],
  postfix: string,
  tagPrefix: string,
): Baseline | null {
  const candidates: Baseline[] = [];

  for (const tag of tags) {
    const stripped = stripPrefix(tag.trim(), tagPrefix);
    if (stripped === null) continue;

    const parsed = semver.parse(stripped, { loose: true });
    if (!parsed) continue;

    if (channelOf(parsed) !== postfix) continue;

    candidates.push({ raw: stripped, version: parsed });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => semver.rcompare(a.version, b.version));
  return candidates[0];
}
