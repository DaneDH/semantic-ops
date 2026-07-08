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
    for (const message of commitMessages) {
      lines.push(`- ${message}`);
    }
  } else {
    lines.push('_No commits since the previous release on this channel._');
  }

  return lines.join('\n');
}
