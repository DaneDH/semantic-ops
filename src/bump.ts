import { BumpType, BumpRuleSet, SemanticOpsConfig } from './config.schema';

const SEVERITY_ORDER: BumpType[] = ['major', 'minor', 'patch'];

function anyPatternMatches(patterns: string[], text: string): boolean {
  return patterns.some((pattern) => new RegExp(pattern).test(text));
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
 * Scans every commit message against commit_rules and returns the
 * highest-severity level with at least one matching pattern across any
 * commit (major > minor > patch).
 */
export function matchCommitRules(commitMessages: string[], rules: BumpRuleSet): BumpType | null {
  for (const level of SEVERITY_ORDER) {
    if (commitMessages.some((message) => anyPatternMatches(rules[level], message))) {
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
