import { BumpType, BumpRuleSet, SemanticOpsConfig } from './config.schema';

const SEVERITY_ORDER: BumpType[] = ['major', 'minor', 'patch'];

function anyPatternMatches(patterns: string[], text: string): boolean {
  return patterns.some((pattern) => new RegExp(pattern).test(text));
}

/** First line of a (possibly multi-line, subject + body) commit message. */
function subjectLine(commitMessage: string): string {
  const newlineIndex = commitMessage.indexOf('\n');
  return newlineIndex === -1 ? commitMessage : commitMessage.slice(0, newlineIndex);
}

/**
 * Rules are grouped by bump level (major/minor/patch arrays of patterns).
 * The highest-severity level with at least one matching pattern wins,
 * regardless of how the patterns are ordered within their level.
 */
export function matchBranchRules(branchName: string, rules: BumpRuleSet): BumpType | null {
  for (const level of SEVERITY_ORDER) {
    if (anyPatternMatches(rules[level], branchName)) return level;
  }
  return null;
}

/**
 * Scans every commit's subject line (not the full body -- commit messages
 * may now carry a full body for release-notes purposes, and matching
 * against body prose risks an incidental substring match, e.g. a sentence
 * mentioning "fix:" that isn't a Conventional Commits type marker) against
 * commit_rules, returning the highest-severity level with at least one
 * matching subject (major > minor > patch).
 */
export function matchCommitRules(commitMessages: string[], rules: BumpRuleSet): BumpType | null {
  const subjects = commitMessages.map(subjectLine);
  for (const level of SEVERITY_ORDER) {
    if (subjects.some((subject) => anyPatternMatches(rules[level], subject))) {
      return level;
    }
  }
  return null;
}

export function resolveBump(
  branchName: string,
  commitMessages: string[],
  config: SemanticOpsConfig,
): BumpType {
  const branchBump = matchBranchRules(branchName, config.branch_rules);
  const commitBump = matchCommitRules(commitMessages, config.commit_rules);

  if (branchBump && commitBump) {
    if (branchBump === commitBump) return branchBump;
    return config.precedence === 'branch-first' ? branchBump : commitBump;
  }

  return branchBump ?? commitBump ?? config.default_bump;
}
