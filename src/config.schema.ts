import { z } from 'zod';
import * as semver from 'semver';

export const BumpType = z.enum(['major', 'minor', 'patch']);
export type BumpType = z.infer<typeof BumpType>;

const initialVersion = z
  .string()
  .default('1.0.0')
  .superRefine((value, ctx) => {
    const parsed = semver.parse(value, { loose: true });
    if (!parsed || parsed.prerelease.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `must be a plain semver version with no prerelease, e.g. "1.0.0" (got "${value}")`,
      });
    }
  });

const regexPattern = z.string().min(1).superRefine((pattern, ctx) => {
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `not a valid regular expression: ${(err as Error).message}`,
    });
  }
});

// Patterns are grouped by bump level rather than one-pattern-per-rule, so a
// project can list as many patterns as it wants for major/minor/patch
// without repeating `bump: <level>` on every entry.
const BumpRuleSet = z.object({
  major: z.array(regexPattern).default([]),
  minor: z.array(regexPattern).default([]),
  patch: z.array(regexPattern).default([]),
});
export type BumpRuleSet = z.infer<typeof BumpRuleSet>;

const PostfixRule = z.object({
  pattern: regexPattern,
  postfix: z.string().min(1),
});
export type PostfixRule = z.infer<typeof PostfixRule>;

export const ConfigSchema = z.object({
  main_branch: z.string().min(1).default('main'),
  tag_prefix: z.string().default('v'),
  default_bump: BumpType.default('patch'),
  precedence: z.enum(['branch-first', 'commit-first']).default('commit-first'),
  default_postfix: z.string().default(''),
  initial_version: initialVersion,
  create_release: z.boolean().default(true),
  branch_rules: BumpRuleSet.default({}),
  commit_rules: BumpRuleSet.default({}),
  branch_postfix_rules: z.array(PostfixRule).default([]),
});

export type SemanticOpsConfig = z.infer<typeof ConfigSchema>;
