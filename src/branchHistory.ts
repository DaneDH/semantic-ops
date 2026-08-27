import { getExecOutput } from '@actions/exec';
import { GitError } from './commits';

/**
 * NUL-delimited so multi-line tag messages/bodies split cleanly -- tag
 * content can contain anything except NUL, so this is safe as a separator
 * where a plain newline wouldn't be.
 */
const TAG_MESSAGE_SEPARATOR = '\x00';

async function allTagMessages(): Promise<string[]> {
  const result = await getExecOutput(
    'git',
    ['for-each-ref', 'refs/tags', `--format=%(contents)${TAG_MESSAGE_SEPARATOR}`],
    { silent: true, ignoreReturnCode: true },
  );
  if (result.exitCode !== 0) {
    throw new GitError(`"git for-each-ref refs/tags" failed: ${result.stderr.trim()}`);
  }
  return result.stdout
    .split(TAG_MESSAGE_SEPARATOR)
    .map((message) => message.trim())
    .filter((message) => message.length > 0);
}

/**
 * Whether this branch has ever produced a tag of its own -- not whether the
 * branch ref itself is "new". Those two differ exactly when a branch's first
 * push succeeds through compute but a later step (typecheck/test/build/
 * release) fails before a tag is created: the branch ref already exists on
 * retry, but no tag has ever actually been made for it.
 *
 * Answered by a direct marker, not commit-graph ancestry: every tag this
 * tool creates has its source branch stamped as the LAST line of its
 * annotated message, `branch_name: [<branch>]` (see release.ts). Matching
 * only that exact last line -- rather than searching the whole message --
 * keeps this immune to a branch name coincidentally appearing inside a
 * commit message embedded earlier in the tag's body.
 *
 * An ancestry-based check (does the branch's git history contain a tag not
 * shared with main) was tried first and discarded: it silently breaks the
 * moment a tagged commit stops being an ancestor of the branch's current
 * tip, which happens after any rebase/amend + force-push on the branch --
 * exactly the kind of thing active feature branches do routinely.
 */
export async function hasBranchAlreadyBeenTagged(branchName: string): Promise<boolean> {
  const marker = `branch_name: [${branchName}]`;
  const messages = await allTagMessages();
  return messages.some((message) => {
    const lines = message.split('\n').map((line) => line.trim());
    const lastNonEmpty = [...lines].reverse().find((line) => line.length > 0);
    return lastNonEmpty === marker;
  });
}
