import { SemanticOpsConfig } from './config.schema';

/**
 * Postfix (prerelease label) is resolved ONLY from branch name, via a rule set
 * that is independent from branch_rules (which decide bump type, not postfix).
 */
export function resolvePostfix(branchName: string, config: SemanticOpsConfig): string {
  if (branchName === config.main_branch) {
    return '';
  }

  for (const rule of config.branch_postfix_rules) {
    if (new RegExp(rule.pattern).test(branchName)) {
      return rule.postfix;
    }
  }

  return config.default_postfix;
}
