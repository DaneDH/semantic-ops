import { describe, it, expect, vi, beforeEach } from 'vitest';

const getExecOutputMock = vi.fn();

vi.mock('@actions/exec', () => ({
  getExecOutput: (...args: unknown[]) => getExecOutputMock(...args),
}));

import { hasBranchAlreadyBeenTagged } from '../src/branchHistory';
import { GitError } from '../src/commits';

const SEP = '\x00';

beforeEach(() => {
  getExecOutputMock.mockReset();
});

function mockForEachRef(exitCode: number, messages: string[] | string) {
  const stdout = Array.isArray(messages) ? messages.map((m) => `${m}${SEP}`).join('') : messages;
  getExecOutputMock.mockImplementation(async (_cmd: string, args: string[]) => {
    if (args[0] !== 'for-each-ref') throw new Error(`Unexpected git invocation in test: git ${args.join(' ')}`);
    return { exitCode, stdout, stderr: exitCode === 0 ? '' : 'boom' };
  });
}

describe('hasBranchAlreadyBeenTagged', () => {
  it('returns true when a tag message ends with a matching branch_name marker', async () => {
    mockForEachRef(0, ['v1.0.0\n\nSome release notes.\n\nbranch_name: [feature/thing]']);

    expect(await hasBranchAlreadyBeenTagged('feature/thing')).toBe(true);
  });

  it('returns false when tags exist but none match this branch', async () => {
    mockForEachRef(0, [
      'v1.0.0\n\nbranch_name: [main]',
      'v1.1.0-beta\n\nbranch_name: [feature/other]',
    ]);

    expect(await hasBranchAlreadyBeenTagged('feature/thing')).toBe(false);
  });

  it('does not match when the marker text appears mid-message rather than as the last line', async () => {
    mockForEachRef(0, [
      'v1.0.0\n\nA commit mentioned branch_name: [feature/thing] in its body.\n\nbranch_name: [main]',
    ]);

    expect(await hasBranchAlreadyBeenTagged('feature/thing')).toBe(false);
  });

  it('returns false when there are no tags at all', async () => {
    mockForEachRef(0, '');

    expect(await hasBranchAlreadyBeenTagged('feature/thing')).toBe(false);
  });

  it('throws a GitError when listing tag messages fails', async () => {
    mockForEachRef(1, '');

    await expect(hasBranchAlreadyBeenTagged('feature/thing')).rejects.toThrow(GitError);
  });
});
