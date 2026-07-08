export interface ReleaseNotesParams {
  bumpType: string;
  postfix: string;
  previousVersion: string;
  commitMessages: string[];
}

/**
 * Builds a release body that explains why this version was chosen, using the
 * exact commit messages semantic-ops scanned to resolve bump_type -- more
 * specific than GitHub's generic auto-generated release notes, which just
 * summarize merged PRs/commits without any bump rationale.
 */
export function buildReleaseBody(params: ReleaseNotesParams): string {
  const { bumpType, postfix, previousVersion, commitMessages } = params;

  const lines: string[] = [
    `**Bump type:** ${bumpType}`,
    `**Channel:** ${postfix || 'production (no postfix)'}`,
  ];

  if (previousVersion) {
    lines.push(`**Previous version:** ${previousVersion}`);
  }

  lines.push('');

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
