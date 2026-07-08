# semantic-ops

Two GitHub Actions that compute the next semantic version **from the latest existing tag/release**, rather than by parsing full commit history like conventional-commits tools do, and separately create the git tag + GitHub Release for it:

- **`semantic-ops/compute`** — resolves the next version and emits it as step outputs. Makes no changes to the repo; safe to run at the very start of a pipeline, before any build/deploy step.
- **`semantic-ops/release`** — takes a previously computed version (typically from `compute`'s outputs) and creates the annotated git tag + GitHub Release.

Splitting these apart means you can compute the version once and use it throughout the pipeline (build artifacts, container tags, etc.), while only tagging the repo at the very end — after a deploy job has actually succeeded. If deploy fails, you simply never call `release`, and the repo is never tagged for a release that didn't happen.

Versions are organized into **channels** by an optional postfix/prerelease label (e.g. `alpha`, `beta`). The postfix is resolved *only* from the branch name. Bumping (major/minor/patch) is resolved from the branch name and/or commit messages, with your choice of which one wins on conflict.

## How it works

1. **Resolve the postfix channel** for the current branch:
   - The configured `main_branch` always resolves to no postfix (production channel).
   - Otherwise, the first matching `branch_postfix_rules` entry wins.
   - Otherwise, `default_postfix` is used (defaults to `""`, i.e. treated as production).
2. **Find the baseline version** — the latest existing tag *in that same channel*. An `alpha` release only ever bumps from the latest `-alpha` tag; a production release only ever bumps from the latest tag with no postfix at all. Different channels never mix.
3. **Resolve the bump type** (major/minor/patch):
   - `branch_rules` groups patterns by bump level (`major`/`minor`/`patch`, each a list). The highest-severity level with any matching pattern wins.
   - `commit_rules` groups patterns the same way, checked against every commit message since the baseline tag. The highest-severity level with any matching commit wins.
   - If both produce a result and they differ, `precedence` (`branch-first` or `commit-first`) decides. If only one produces a result, that one is used. If neither matches, `default_bump` is used.
4. **Compute the next version** by bumping the baseline's release triple and appending the postfix, if any.
5. **`compute` emits outputs**; **`release`**, called separately, creates the annotated git tag + GitHub Release.

## Usage

```yaml
name: Release

on:
  push:
    branches: ['**']

jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      tag_name: ${{ steps.version.outputs.tag_name }}
      version: ${{ steps.version.outputs.version }}
      prerelease: ${{ steps.version.outputs.postfix != '' }}
      bump_type: ${{ steps.version.outputs.bump_type }}
      postfix: ${{ steps.version.outputs.postfix }}
      previous_version: ${{ steps.version.outputs.previous_version }}
      commit_messages: ${{ steps.version.outputs.commit_messages }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # required: full history + tags must be available locally

      - id: version
        uses: your-org/semantic-ops/compute@v1
        with:
          config_path: semantic-ops.yml   # default

      - run: echo "Building ${{ steps.version.outputs.version }} (build ${{ steps.version.outputs.build_number }})"

  deploy:
    needs: version
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying ${{ needs.version.outputs.version }}"
      # ... real build/deploy steps ...
      # if this job fails, the release job below never runs, and the repo is never tagged

  release:
    needs: [version, deploy]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/semantic-ops/release@v1
        with:
          tag_name: ${{ needs.version.outputs.tag_name }}
          version: ${{ needs.version.outputs.version }}
          sha: ${{ github.sha }}
          prerelease: ${{ needs.version.outputs.prerelease }}
          bump_type: ${{ needs.version.outputs.bump_type }}
          postfix: ${{ needs.version.outputs.postfix }}
          previous_version: ${{ needs.version.outputs.previous_version }}
          commit_messages: ${{ needs.version.outputs.commit_messages }}
```

`actions/checkout` must run with `fetch-depth: 0` (or otherwise fetch full history and tags) before the `compute` step — it reads tags and commit history from the local checkout via `git`, not the GitHub API, so a shallow clone will cause it to fail with a clear error.

## `compute` action

Resolves the next version. Makes no repo changes and needs no token.

### Inputs

| Input | Default | Description |
|---|---|---|
| `config_path` | `semantic-ops.yml` | Path to the YAML config file, relative to the repo root. |

### Outputs

| Output | Example | Description |
|---|---|---|
| `version` | `1.33.0-alpha` | The computed next version (no tag prefix). |
| `previous_version` | `1.32.4-alpha` | Baseline version bumped from, within the same channel. |
| `bump_type` | `minor` | `major`, `minor`, or `patch`. |
| `postfix` | `alpha` | Resolved postfix, or empty string if none. |
| `build_number` | `102.8edwfac` | `${run_number}.${short_sha}` (7-char short SHA). |
| `run_id` | `123456789` | The GitHub Actions run ID. |
| `sha` | `8edwfac2...` | Full commit SHA. |
| `tag_name` | `v1.33.0-alpha` | `tag_prefix` + `version` — the exact tag the `release` action should create. |
| `commit_messages` | `feat: add thing\nfix: bug` | Newline-separated subject lines of every commit since the baseline tag on this channel. Pass through to `release` to build a descriptive release body. |

## `release` action

Creates the annotated git tag + GitHub Release for a version already computed by `compute`. Fails loudly if the tag already exists, rather than overwriting it.

If `bump_type` is provided, the Release body is built from `bump_type`/`postfix`/`previous_version`/`commit_messages` — listing the bump rationale and the exact commits that were scanned to produce it, which is more specific than GitHub's generic auto-generated notes. If `bump_type` is omitted, the Release falls back to `generate_release_notes: true`.

### Inputs

| Input | Default | Description |
|---|---|---|
| `tag_name` | — (required) | Exact tag to create, e.g. `compute`'s `tag_name` output. |
| `sha` | — (required) | Commit SHA to tag. |
| `version` | — (required) | Used as the Release title, e.g. `compute`'s `version` output. |
| `prerelease` | `false` (required) | Whether to mark the Release as a prerelease, e.g. derived from `compute`'s `postfix` output being non-empty. |
| `bump_type` | `''` | `compute`'s `bump_type` output. When set, triggers the custom release body described above. |
| `postfix` | `''` | `compute`'s `postfix` output. Used in the custom release body. |
| `previous_version` | `''` | `compute`'s `previous_version` output. Used in the custom release body. |
| `commit_messages` | `''` | `compute`'s `commit_messages` output. Used in the custom release body. |
| `github_token` | `${{ github.token }}` | Token used to create the tag + release. You don't need to create anything — this defaults to the token GitHub Actions automatically injects into every workflow run. The only thing you need to add is `permissions: contents: write` on this job (see the [Usage](#usage) example), which grants that auto-token write access. Only override this input if you need tag pushes to trigger other workflows (the default token deliberately can't do that) — in which case supply your own fine-grained PAT scoped to just this repo. |

### Outputs

| Output | Example | Description |
|---|---|---|
| `release_id` | `123456789` | Numeric ID of the created GitHub Release. |
| `release_url` | `https://github.com/org/repo/releases/tag/v1.33.0-alpha` | HTML URL of the created Release. |

## Configuration (`semantic-ops.yml`)

```yaml
main_branch: main
tag_prefix: v
default_bump: patch          # used when neither branch_rules nor commit_rules match
precedence: commit-first     # branch-first | commit-first — tiebreaker when signals differ
default_postfix: ""          # fallback postfix for branches matching neither main_branch nor any postfix rule
initial_version: "1.0.0"     # first release on a channel with no prior tag -- used as-is, no bump applied

branch_rules:                  # bump signal from branch name — patterns grouped by level, highest matching level wins
  major:
    - '^release/major/'
  minor:
    - '^feature/'
    - '^release/minor/'
  patch:
    - '^hotfix/'
    - '^bugfix/'

commit_rules:                  # bump signal from commit messages — highest-severity level with any matching commit wins
  major:
    - '^BREAKING CHANGE'
    - '!:'
  minor:
    - '^feat(\(.+\))?:'
    - '^feature/'
  patch:
    - '^fix(\(.+\))?:'

branch_postfix_rules:         # postfix resolved ONLY from branch name — a separate rule set from branch_rules
  - pattern: '^alpha/|/alpha$'
    postfix: alpha
  - pattern: '^beta/|/beta$'
    postfix: beta
```

Note that `branch_rules` (bump signal) and `branch_postfix_rules` (postfix/channel signal) are independent — the same branch name is checked against both rule sets, but for different purposes and with different keywords. A branch like `release/major/alpha-payments` could match `branch_rules` for a `major` bump *and* `branch_postfix_rules` for the `alpha` channel, entirely independently.

## Known v1 limitations

- No numeric prerelease counter — releases on a channel are always `-alpha`, never `-alpha.3`. The latest same-channel tag is always the baseline; bump severity is recomputed from only the commits added since that tag on every run, so a re-run with no new bump-worthy commits recomputes the same version. Attempting to tag it again will fail loudly rather than silently duplicate a release.
- Cold start: a channel with no prior tag starts at `initial_version` (default `1.0.0`) directly — no bump is applied to it, since there's no baseline to bump from. Set `initial_version` in the config to start a channel somewhere else (e.g. `"0.1.0"`).
- Config validation errors surface as a formatted list of field/message pairs; a missing config file or malformed YAML fails the run with an actionable message.

## Local verification

Before wiring this into a real workflow, sanity-check version computation against a real local repo (no GitHub API calls, no tag/release created):

```sh
npm run dry-run -- --repo . --branch feature/alpha-foo --config semantic-ops.yml
```

This prints the resolved postfix, baseline, scanned commit messages, bump type, and computed version as JSON.
