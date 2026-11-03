# Contributing

## Branches

| Branch | Role | Who writes to it |
| --- | --- | --- |
| `dev` | Integration and staging. Every change lands here first and is tested together. Merges build the app images once, and Flux pins their digests here. | Pull requests (squash-merged), Flux image pins |
| `main` | What is deployed, and the default branch. Flux deploys the image digests pinned here, and release-please cuts Snapflow releases from it. | Promotion pull requests from `dev` (merge commit), the release-please pull request, `hotfix/*` pull requests |

```
feature/x ──squash──▶ dev ──▶ images ──▶ Flux pins digests on dev
                       │
                       └──merge commit──▶ main ──▶ Flux deploys the pinned images, release-please
                       ▲                     │
                       └─── sync-dev.yml ◀───┘  (release commits, hotfixes, rollbacks)
```

1. Branch from `dev`, open a pull request into `dev` (GitHub proposes `main`, the default branch; change the base). `CI passed` fails any pull request into `main` that does not come from `dev`, release-please or a `hotfix/*` branch. Its title must follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `chore:` ...) because the squashed commit takes the title, and release-please versions from it.
2. `CI passed` must be green before merging. Squash-merge. A pull request runs only the CI suites its changes can affect ([`.github/filters/ci.yml`](.github/filters/ci.yml)), so a documentation change checks in about a minute; pushes to `dev` and `main` run every suite.
3. A merge into `dev` publishes images for the apps it changed, and Flux pins their digests on `dev` within about five minutes. To deploy, wait for that pin commit, then open a pull request from `dev` into `main` titled `chore: promote dev to main` and merge it with a **merge commit**. Production then runs the exact images built and scanned on `dev`. Never squash or rebase a promotion: `main` would get commits `dev` never had, and every later promotion would conflict.
4. Images are built only from `dev`, so a code fix reaches production through `dev` and a promotion. `hotfix/<name>` branches from `main` are for changes that need no new image: a rollback to earlier image pins, or a deploy configuration fix. Merge them into `main` with a merge commit.
5. Commits that reach `main` outside a promotion (a merged release pull request, a hotfix or rollback) come back to `dev` through the `chore: merge main into dev` pull request that `sync-dev.yml` opens. Merge it with a merge commit as well. If it reports a conflict, merge `dev` into its branch locally, resolve, and push.

## Dependencies

[Renovate](https://docs.renovatebot.com) keeps dependencies current, configured in [`.github/renovate.json5`](.github/renovate.json5). Every Monday morning it opens one pull request into `dev` with every minor, patch and digest update at least seven days old, and squash-merges it itself once `CI passed` is green. A failing one stays open for you. Go toolchain updates get their own pull request, merged by hand. Major versions wait until they are approved on the *Dependency Dashboard* issue. Security fixes skip the schedule and the wait. Nothing Renovate merges reaches production until you promote `dev`.

## Repository setup

Done once per repository:

1. *Settings > General*: default branch `main`. It stays `main` because scheduled workflows run only on the default branch: `tuf-refresh.yml` signs with the `snapflow-release` environment, which only `main` may use, and the repository page shows what is deployed. Under *Pull Requests* allow merge commits and squash merging (both titled from the pull request), disallow rebase merging, enable *Always suggest updating pull request branches*, *Allow auto-merge* (Renovate merges its own pull requests with it) and *Automatically delete head branches*.
2. *Settings > Rules > Rulesets > New ruleset > Import a ruleset*: import [`.github/rulesets/main.json`](.github/rulesets/main.json), [`.github/rulesets/dev.json`](.github/rulesets/dev.json) and [`.github/rulesets/tags.json`](.github/rulesets/tags.json). The branch rulesets require a pull request and the `CI passed` check and block force pushes and deletion; `main` accepts only merge commits, `dev` squash and merge commits. The tag ruleset lets only the automation App create, move or delete `v*` release tags. The App is also the only actor that may push to `dev` directly, for Flux image automation's digest pins; nothing bypasses `main`.
3. *Settings > Actions > General*: require actions to be pinned to a full-length commit SHA (every workflow already pins them), require approval of workflow runs for all external contributors (the KVM runners are self-hosted), and set *Workflow permissions* to read repository contents (jobs request more themselves).
4. *Automation App*: the `snapflowio-automation` GitHub App (Contents, Pull requests, Issues and Workflows: read and write; no webhook) opens the release-please and main-to-dev pull requests, creates release tags and pushes Flux image pins to `dev`. Pull requests it opens start CI like any other, which `GITHUB_TOKEN` pull requests do not. Install it on this repository only. Store its Client ID in the repository variable `SNAPFLOW_AUTOMATION_CLIENT_ID`, and its private key in the `snapflow-automation` environment, which only `main` may deploy to, so no workflow run from another branch can use it: `gh secret set SNAPFLOW_AUTOMATION_PRIVATE_KEY --env snapflow-automation < key.pem`. Flux keeps its own copy in the cluster ([docs/deployment.md](docs/deployment.md)).
5. *Settings > Advanced Security*: enable Dependabot alerts (Renovate reads them for its security pull requests), secret scanning and push protection. Leave Dependabot security updates and version updates off; Renovate opens those pull requests.
6. Install the [Renovate GitHub App](https://github.com/apps/renovate) on this repository only.
7. The [Blacksmith](https://www.blacksmith.sh) GitHub App must have access to this repository: the CI suites, CodeQL, the dependency audits and the dev container build run on its `blacksmith-4vcpu-ubuntu-2404` runners, and their jobs wait in the queue without it. Releases, promotion, TUF signing and image publishing stay on GitHub-hosted runners, so their signatures and build attestations come from GitHub's own builders.
8. The release environments, secrets and KVM runners are in [docs/releases.md](docs/releases.md#one-time-setup).
