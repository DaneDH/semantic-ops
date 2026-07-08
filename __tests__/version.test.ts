import { describe, it, expect } from 'vitest';
import { computeNextVersion } from '../src/version';
import { findBaselineTag } from '../src/baseline';

describe('computeNextVersion', () => {
  it('bumps patch/minor/major off the baseline release triple', () => {
    const baseline = findBaselineTag(['v2.12.29'], '', 'v');
    expect(computeNextVersion(baseline, 'patch', '', '1.0.0')).toBe('2.12.30');
    expect(computeNextVersion(baseline, 'minor', '', '1.0.0')).toBe('2.13.0');
    expect(computeNextVersion(baseline, 'major', '', '1.0.0')).toBe('3.0.0');
  });

  it('appends the postfix when one is resolved', () => {
    const baseline = findBaselineTag(['v1.32.4-alpha'], 'alpha', 'v');
    expect(computeNextVersion(baseline, 'patch', 'alpha', '1.0.0')).toBe('1.32.5-alpha');
  });

  it('cold-starts at initial_version, unbumped, when there is no baseline for the channel', () => {
    expect(computeNextVersion(null, 'minor', '', '1.0.0')).toBe('1.0.0');
    expect(computeNextVersion(null, 'major', '', '1.0.0')).toBe('1.0.0');
    expect(computeNextVersion(null, 'minor', 'alpha', '1.0.0')).toBe('1.0.0-alpha');
  });

  it('respects a custom initial_version on cold start', () => {
    expect(computeNextVersion(null, 'patch', '', '2.5.0')).toBe('2.5.0');
    expect(computeNextVersion(null, 'patch', 'beta', '0.1.0')).toBe('0.1.0-beta');
  });

  it('drops the existing prerelease number consistent with a channel-triple bump', () => {
    const baseline = findBaselineTag(['v1.5.0-beta'], 'beta', 'v');
    expect(computeNextVersion(baseline, 'major', 'beta', '1.0.0')).toBe('2.0.0-beta');
  });
});
