<p align="center">
  <img src="assets/logo.svg" alt="SemanticOps" width="480">
</p>

A single GitHub Action that computes the next semantic version **from the latest existing tag/release**, rather than by parsing full commit history like conventional-commits tools do, and creates the git tag + GitHub Release for it. It runs in one of two modes, selected via the `mode` input, so you call it at different stages of the same pipeline:

- **`mode: compute`** — resolves the next version and emits it as step outputs. Makes no changes to the repo; safe to run at the very start of a pipeline, before any build/deploy step.
- **`mode: release`** — takes a previously computed version (typically from a prior `compute` step's outputs) and creates the annotated git tag + GitHub Release.

Calling it twice like this means you can compute the version once and use it throughout the pipeline (build artifacts, container tags, etc.), while only tagging the repo at the very end — after a deploy job has actually succeeded. If deploy fails, you simply never call the `release` step, and the repo is never tagged for a release that didn't happen.

Versions are organized into **channels** by an optional postfix/prerelease label (e.g. `alpha`, `beta`). The postfix is resolved *only* from the branch name. Bumping (major/minor/patch) is resolved from the branch name and/or commit messages, with your choice of which one wins on conflict.

### Tag-as-source-of-truth: the Semantic Ops way

Most semantic versioning tools reconstruct the next version by parsing your entire commit history against a strict message format (Conventional Commits, etc.) — which means every contributor has to get the format right, squash-merges can eat the signal, and a single mis-typed commit can silently produce the wrong bump. Semantic Ops takes a different, simpler stance: **the last tag is the source of truth.** The next version is always "the latest tag on this channel, bumped" — not a full replay of history. Commit messages are an optional signal you can lean on if you want, but branch naming alone is enough to drive the entire system if you'd rather not think about commit hygiene at all.

This also means version channels (production, `alpha`, `beta`, or anything else you name) are independent, honest histories rather than one contorted timeline — a channel's tag always reflects exactly what happened on that channel, nothing more.

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
5. **`mode: compute` emits outputs**; **`mode: release`**, called separately, creates the annotated git tag + GitHub Release.

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
        uses: your-org/semantic-ops@v1
        with:
          mode: compute
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
      - uses: your-org/semantic-ops@v1
        with:
          mode: release
          tag_name: ${{ needs.version.outputs.tag_name }}
          version: ${{ needs.version.outputs.version }}
          sha: ${{ github.sha }}
          prerelease: ${{ needs.version.outputs.prerelease }}
          bump_type: ${{ needs.version.outputs.bump_type }}
          postfix: ${{ needs.version.outputs.postfix }}
          previous_version: ${{ needs.version.outputs.previous_version }}
          commit_messages: ${{ needs.version.outputs.commit_messages }}
```

`actions/checkout` must run with `fetch-depth: 0` (or otherwise fetch full history and tags) before the `compute`-mode step — it reads tags and commit history from the local checkout via `git`, not the GitHub API, so a shallow clone will cause it to fail with a clear error.

## Inputs

| Input | Used in mode | Default | Description |
|---|---|---|---|
| `mode` | both (required) | — | `compute` or `release`. |
| `config_path` | both | `semantic-ops.yml` | Path to the YAML config file, relative to the repo root. `compute` uses it for all version-resolution rules; `release` uses it to read `create_release` (see [Tag-only mode](#tag-only-mode-create_release-false) below) as the default, unless overridden by the `create_release` input below. |
| `tag_name` | `release` (required) | — | Exact tag to create, e.g. a prior `compute` step's `tag_name` output. |
| `sha` | `release` (required) | — | Commit SHA to tag. |
| `version` | `release` (required) | — | Used as the Release title, e.g. a prior `compute` step's `version` output. |
| `prerelease` | `release` (required) | `false` | Whether to mark the Release as a prerelease, e.g. derived from `compute`'s `postfix` output being non-empty. |
| `create_release` | `release`, optional | *(unset)* | `'true'` or `'false'` to override the config file's `create_release` field for this one job/run. Leave unset (the default — note there is no default *value*) to use whatever `semantic-ops.yml` says. |
| `bump_type` | `release`, optional | `''` | A prior `compute` step's `bump_type` output. When set, triggers the custom release body described below. |
| `postfix` | `release`, optional | `''` | A prior `compute` step's `postfix` output. Used in the custom release body. |
| `previous_version` | `release`, optional | `''` | A prior `compute` step's `previous_version` output. Used in the custom release body. |
| `commit_messages` | `release`, optional | `''` | A prior `compute` step's `commit_messages` output. Used in the custom release body. |
| `github_token` | `release` | `${{ github.token }}` | Token used to create the tag + release. You don't need to create anything — this defaults to the token GitHub Actions automatically injects into every workflow run. The only thing you need to add is `permissions: contents: write` on this job (see the [Usage](#usage) example), which grants that auto-token write access. Only override this input if you need tag pushes to trigger other workflows (the default token deliberately can't do that) — in which case supply your own fine-grained PAT scoped to just this repo. |

## Outputs

| Output | Produced by mode | Example | Description |
|---|---|---|---|
| `version` | `compute` | `1.33.0-alpha` | The computed next version (no tag prefix). |
| `previous_version` | `compute` | `1.32.4-alpha` | Baseline version bumped from, within the same channel. |
| `bump_type` | `compute` | `minor` | `major`, `minor`, or `patch`. |
| `postfix` | `compute` | `alpha` | Resolved postfix, or empty string if none. |
| `build_number` | `compute` | `102.8edwfac` | `${run_number}.${short_sha}` (7-char short SHA). |
| `run_id` | `compute` | `123456789` | The GitHub Actions run ID. |
| `sha` | `compute` | `8edwfac2...` | Full commit SHA. |
| `tag_name` | `compute` | `v1.33.0-alpha` | `tag_prefix` + `version` — the exact tag a later `release`-mode step should create. |
| `commit_messages` | `compute` | `feat: add thing\nfix: bug` | Newline-separated subject lines of every commit since the baseline tag on this channel. Pass through to a `release`-mode step to build a descriptive release body. |
| `create_release` | `compute` | `true` | Config's `create_release` field (`"true"`/`"false"`), for informational use in your own workflow conditions (e.g. skip a "notify about new release" step). `release` mode reads this directly from the config file itself, so this output does not need to be passed to it. |
| `release_id` | `release` | `123456789` | Numeric ID of the created GitHub Release. Empty if `create_release` was `false`. |
| `release_url` | `release` | `https://github.com/org/repo/releases/tag/v1.33.0-alpha` | HTML URL of the created Release. Empty if `create_release` was `false`. |

`mode: release` fails loudly if the tag already exists, rather than overwriting it. If `bump_type` is provided, the Release body is built from `bump_type`/`postfix`/`previous_version`/`commit_messages` — listing the bump rationale and the exact commits that were scanned to produce it, which is more specific than GitHub's generic auto-generated notes. If `bump_type` is omitted, the Release falls back to `generate_release_notes: true`. Either way, that same content also becomes the annotated tag's own message, so `git show <tag>` and GitHub's Tags page show real content even when no Release exists yet.

### Tag-only mode (`create_release: false`)

Set `create_release: false` in `semantic-ops.yml` to have the pipeline create the git tag on every qualifying push, without also creating a GitHub Release. `release` mode reads this field straight from the config file (via its `config_path` input) as the default for every run, so it's not something a workflow can forget to wire through.

This solves a real GitHub Marketplace limitation: publishing to Marketplace requires manually creating a Release and checking "Publish this Action to the GitHub Marketplace" — but that checkbox isn't available for a tag that already has an automated Release attached, and GitHub rejects "tag name has already been taken" if you try. With `create_release: false`, the tag exists but stays un-released, so you can create the Release for it by hand whenever you're ready to publish.

**Overriding for a single run:** pass `create_release: 'true'` (or `'false'`) directly on a specific `release`-mode step to override the config file just for that job, without editing `semantic-ops.yml`. This is useful for e.g. a manually-triggered `workflow_dispatch` run where you want the opposite of the usual behavior just once:

```yaml
- uses: your-org/semantic-ops@v1
  with:
    mode: release
    create_release: 'true'   # overrides semantic-ops.yml's create_release: false, for this run only
    tag_name: ${{ needs.version.outputs.tag_name }}
    version: ${{ needs.version.outputs.version }}
    sha: ${{ github.sha }}
    prerelease: ${{ needs.version.outputs.prerelease }}
```

Leaving `create_release` unset (the normal case) always falls back to the config file — the override only takes effect when a step explicitly sets it to `'true'` or `'false'`.

## Configuration (`semantic-ops.yml`)

```yaml
main_branch: main
tag_prefix: v
default_bump: patch          # used when neither branch_rules nor commit_rules match
precedence: commit-first     # branch-first | commit-first — tiebreaker when signals differ
default_postfix: ""          # fallback postfix for branches matching neither main_branch nor any postfix rule
initial_version: "1.0.0"     # first release on a channel with no prior tag -- used as-is, no bump applied
create_release: true         # false = tag only, no GitHub Release (see "Tag-only mode" below)

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
