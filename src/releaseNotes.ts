export interface ReleaseNotesParams {
  bumpType: string;
  postfix: string;
  previousVersion: string;
  commitMessages: string[];
}

function bumpLabel(bumpType: string): string {
  return `${bumpType.charAt(0).toUpperCase()}${bumpType.slice(1)} update`;
}

/**
 * Builds a release body that explains why this version was chosen, using the
 * exact commit messages semantic-ops scanned to resolve bump_type -- more
 * specific than GitHub's generic auto-generated release notes, which just
 * summarize merged PRs/commits without any bump rationale.
 *
 * The Release title is just the version (set by the caller), so this body
 * leads with one light descriptive line -- not a stack of bold labels
 * competing with the title -- before the commit list.
 */
export function buildReleaseBody(params: ReleaseNotesParams): string {
  const { bumpType, postfix, previousVersion, commitMessages } = params;

  const channel = postfix ? `${postfix} channel` : 'production';
  let summary = `_${bumpLabel(bumpType)} — ${channel}`;
  if (previousVersion) {
    summary += `, bumped from ${previousVersion}`;
  }
  summary += '._';

  const lines: string[] = [summary, ''];

  if (commitMessages.length > 0) {
    lines.push('**Commits included in this release:**');
    lines.push('');
    for (const message of commitMessages) {
      const [subject, ...bodyLines] = message.split('\n');
      lines.push(`- ${subject}`);
      const body = bodyLines.join('\n').trim();
      if (body) {
        lines.push('');
        for (const bodyLine of body.split('\n')) {
          // Indented to nest under the bullet as a continuation paragraph
          // in GitHub-flavored markdown, instead of breaking the list.
          lines.push(bodyLine.length > 0 ? `  ${bodyLine}` : '');
        }
        lines.push('');
      }
    }
  } else {
    lines.push('_No commits since the previous release on this channel._');
  }

  return lines.join('\n');
}
