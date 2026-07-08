import { describe, it, expect } from 'vitest';
import { findBaselineTag } from '../src/baseline';

describe('findBaselineTag', () => {
  it('picks the highest version for the empty (production) channel, ignoring prerelease tags', () => {
    const tags = ['v1.0.0', 'v2.12.29', 'v2.12.28', 'v1.9.0-beta', 'v3.0.0-alpha'];
    const result = findBaselineTag(tags, '', 'v');
    expect(result?.raw).toBe('2.12.29');
  });

  it('picks the highest version within the alpha channel only', () => {
    const tags = ['v1.32.4-alpha', 'v1.33.0-alpha', 'v2.0.0', 'v1.33.0-beta'];
    const result = findBaselineTag(tags, 'alpha', 'v');
    expect(result?.raw).toBe('1.33.0-alpha');
  });

  it('picks the highest version within the beta channel only', () => {
    const tags = ['v2.12.28-beta', 'v2.12.27-beta', 'v2.12.29'];
    const result = findBaselineTag(tags, 'beta', 'v');
    expect(result?.raw).toBe('2.12.28-beta');
  });

  it('returns null when no tags exist for the channel (cold start)', () => {
    const tags = ['v1.0.0', 'v1.0.0-beta'];
    expect(findBaselineTag(tags, 'alpha', 'v')).toBeNull();
  });

  it('ignores tags that do not match the configured tag_prefix', () => {
    const tags = ['1.0.0', 'release-1.0.0'];
    expect(findBaselineTag(tags, '', 'v')).toBeNull();
  });

  it('ignores malformed / non-semver tags rather than throwing', () => {
    const tags = ['v1.0.0', 'v-not-a-version', 'vlatest'];
    const result = findBaselineTag(tags, '', 'v');
    expect(result?.raw).toBe('1.0.0');
  });

  it('supports an empty tag_prefix', () => {
    const tags = ['1.2.3', '1.3.0'];
    const result = findBaselineTag(tags, '', '');
    expect(result?.raw).toBe('1.3.0');
  });
});
