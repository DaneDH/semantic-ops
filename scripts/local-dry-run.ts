/* eslint-disable no-console */
import { execFileSync } from 'child_process';
import * as path from 'path';
import { loadConfig } from '../src/config';
import { resolvePostfix } from '../src/postfix';
import { findBaselineTag } from '../src/baseline';
import { resolveBump } from '../src/bump';
import { computeNextVersion } from '../src/version';

/**
 * Local verification harness. Runs the full read/compute pipeline against a
 * real local repo using real `git log`/`git tag`, WITHOUT ever calling the
 * GitHub API or creating a tag/release. Lets you sanity-check version
 * computation before pushing a workflow run.
 *
 * Usage:
 *   npm run dry-run -- --repo . --branch feature/alpha-foo --config semantic-ops.yml
 */
function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function git(repo: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const repo = path.resolve(args.repo ?? '.');
  const configPath = path.resolve(repo, args.config ?? 'semantic-ops.yml');
  const branchName = args.branch ?? git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();

  const config = loadConfig(configPath);

  const postfix = resolvePostfix(branchName, config);
  const tags = git(repo, ['tag', '-l'])
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
  const baseline = findBaselineTag(tags, postfix, config.tag_prefix);

  const range = baseline ? `${config.tag_prefix}${baseline.raw}..HEAD` : 'HEAD';
  const commitMessages = git(repo, ['log', range, '--pretty=%s'])
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const bumpType = resolveBump(branchName, commitMessages, config);
  const version = computeNextVersion(baseline, bumpType, postfix, config.initial_version);
  const sha = git(repo, ['rev-parse', 'HEAD']).trim();

  console.log(
    JSON.stringify(
      {
        branchName,
        postfix: postfix || null,
        baseline: baseline ? baseline.raw : null,
        commitMessagesScanned: commitMessages,
        bumpType,
        version,
        tagName: `${config.tag_prefix}${version}`,
        sha,
        note: 'DRY RUN: no tag or release was created.',
      },
      null,
      2,
    ),
  );
}

main();
