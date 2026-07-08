import * as semver from 'semver';
import { BumpType } from './config.schema';
import { Baseline } from './baseline';

/**
 * Computes the next version for a channel. v1 deliberately does not maintain
 * a numeric prerelease counter (e.g. "-alpha.3") -- the latest same-channel
 * tag is always the baseline, and bump severity is recomputed from only the
 * commits added since that tag on every run, so a fresh push with no new
 * bump-worthy commits will recompute the same version rather than
 * incrementing further. Re-tagging then fails loudly (tag already exists)
 * instead of silently double-releasing.
 */
export function computeNextVersion(
  baseline: Baseline | null,
  bump: BumpType,
  postfix: string,
  initialVersion: string,
): string {
  // Cold start: no tag exists yet for this channel. The channel's very first
  // release IS the configured initial_version (default "1.0.0") -- no bump
  // is applied, since there's nothing to bump from yet.
  if (!baseline) {
    return postfix ? `${initialVersion}-${postfix}` : initialVersion;
  }

  // Bump off the release triple only (major.minor.patch), ignoring any
  // existing prerelease on the baseline -- semver.inc('patch') on a
  // prerelease version (e.g. "1.32.4-alpha") just drops the prerelease
  // without incrementing, since a prerelease already sorts below its release
  // counterpart. We want to always advance from the release core instead.
  const baseCore = `${baseline.version.major}.${baseline.version.minor}.${baseline.version.patch}`;
  const bumped = semver.inc(baseCore, bump);
  if (!bumped) {
    throw new Error(`Failed to compute next version from baseline "${baseCore}" with bump "${bump}"`);
  }
  return postfix ? `${bumped}-${postfix}` : bumped;
}
