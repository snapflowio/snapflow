# Contributing

## Branches

`main` is the only long-lived branch: the default branch and what is deployed. Every change reaches it as a squash-merged pull request; besides those, only Flux image pins and the release-please pull request write to it.

```
feature/x ──squash──▶ main ──▶ images ──▶ Flux pins digests on main and deploys them
                        │
                        └──▶ release-please
```

1. Branch from `main` and open a pull request into `main`. Its title must follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `chore:` ...) because it becomes the squashed commit's subject, and release-please versions from it. The pull request body becomes the commit message, so say what changed and why.
2. `CI passed` must be green before merging. Squash-merge. A pull request runs only the CI suites its changes can affect ([`.github/filters/ci.yml`](.github/filters/ci.yml)), so a documentation change checks in about a minute; pushes to `main` run every suite.
3. A merge into `main` publishes images for the apps it changed, and Flux pins their digests on `main` and deploys them within minutes. Production runs the exact images built and scanned from that commit.
4. To roll back, revert the commit with a normal pull request; its merge builds and deploys the reverted code the same way. To pin the previous digests instead, run `flux suspend image update snapflow` first, otherwise image automation pins the newest build again, then change the digests in `deploy/apps/production` with a pull request and resume automation once a fix is merged.

## Dependencies

[Renovate](https://docs.renovatebot.com) keeps dependencies current, configured in [`.github/renovate.json5`](.github/renovate.json5). Every Monday morning it opens one pull request into `main` with every minor, patch and digest update at least seven days old, and squash-merges it itself once `CI passed` is green. A failing one stays open for you. Go toolchain updates get their own pull request, merged by hand. Major versions wait until they are approved on the *Dependency Dashboard* issue. Security fixes skip the schedule and the wait. What Renovate merges deploys like any other merge into `main`.

## Repository setup

Done once per repository:

1. *Settings > General*: default branch `main`. It stays `main` because scheduled workflows run only on the default branch: `tuf-refresh.yml` signs with the `beta` environment, which only `main` may use, and the repository page shows what is deployed. Under *Pull Requests* allow only squash merging, with the default commit message set to the pull request title and description; disallow merge commits and rebase merging, enable *Always suggest updating pull request branches*, *Allow auto-merge* (Renovate merges its own pull requests with it) and *Automatically delete head branches*.
2. *Settings > Rules > Rulesets > New ruleset > Import a ruleset*: import [`.github/rulesets/main.json`](.github/rulesets/main.json) and [`.github/rulesets/tags.json`](.github/rulesets/tags.json). The branch ruleset requires a pull request and the `CI passed` check, accepts only squash merges, and blocks force pushes and deletion. The tag ruleset lets only the automation App create, move or delete `v*` release tags. The App is also the only actor that may push to `main` directly, for Flux image automation's digest pins.
3. *Settings > Actions > General*: require actions to be pinned to a full-length commit SHA (every workflow already pins them), require approval of workflow runs for all external contributors (the KVM runners are self-hosted), and set *Workflow permissions* to read repository contents (jobs request more themselves).
4. *Automation App*: the `snapflowio-automation` GitHub App (Contents, Pull requests, Issues and Workflows: read and write; no webhook) opens the release-please pull request, creates release tags and pushes Flux image pin commits to `main`. Pull requests it opens start CI like any other, which `GITHUB_TOKEN` pull requests do not. Install it on this repository only. Store its Client ID in the repository variable `SNAPFLOW_AUTOMATION_CLIENT_ID`, and its private key in the `automation` environment, which only `main` may deploy to, so no workflow run from another branch can use it: `gh secret set SNAPFLOW_AUTOMATION_PRIVATE_KEY --env automation < key.pem`. Flux keeps its own copy in the cluster ([`deploy/scripts/bootstrap-flux.sh`](deploy/scripts/bootstrap-flux.sh)).
5. *Settings > Advanced Security*: enable Dependabot alerts (Renovate reads them for its security pull requests), secret scanning and push protection. Leave Dependabot security updates and version updates off; Renovate opens those pull requests.
6. Install the [Renovate GitHub App](https://github.com/apps/renovate) on this repository only.
7. The [Blacksmith](https://www.blacksmith.sh) GitHub App must have access to this repository: the CI suites, CodeQL, the dependency audits and the dev container build run on its `blacksmith-4vcpu-ubuntu-2404` runners, and their jobs wait in the queue without it. Releases, stable promotion, TUF signing and image publishing stay on GitHub-hosted runners, so their signatures and build attestations come from GitHub's own builders.
8. The release environments, secrets, TUF ceremony and KVM runners are in [apps/snapflow/internal/tuf/trust/README.md](apps/snapflow/internal/tuf/trust/README.md#one-time-setup).
