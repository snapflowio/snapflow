# Releases

Snapflow machines run one self-contained release: the `snapflow` CLI, the `snapflowd` daemon, the microVM runtime and the guest platform. Releases are versioned from Conventional Commits, built and tested in GitHub Actions, published on [GitHub Releases](https://github.com/snapflowio/snapflow/releases), and delivered to machines through a [TUF](https://theupdateframework.io) repository at `https://releases.snapflow.io`.

## How a release happens

1. Commits land on `dev` as squashed pull requests with [Conventional Commits](https://www.conventionalcommits.org) titles (enforced on pull requests), and reach `main` when `dev` is promoted with a merge commit (see [CONTRIBUTING.md](../CONTRIBUTING.md#branches)). `fix:` bumps the patch version, `feat:` the minor version; while the version is below 1.0.0 a breaking change (`feat!:`) bumps the minor version.
2. [release-please](https://github.com/googleapis/release-please) keeps a release pull request open that updates `apps/snapflow/CHANGELOG.md` and `.release-please-manifest.json`. Every commit counts except those confined to code the native release does not ship (the `exclude-paths` in `release-please-config.json`: the api, dashboard, edge, marketing, snapshot-manager, TypeScript libraries and `deploy/`).
3. Merging the release pull request makes release-please tag the merge commit `vX.Y.Z` and create a draft GitHub release.
4. The same `main` run calls `release.yml`, which builds from the tagged commit and publishes:

```
main.yml (push to main)
├── ci.yml
├── images.yml                      app images for Flux
└── release-please ── release.yml   only when a release was created
    prepare           tag is on main, trust/root.json holds the production root
    ├── erofs-utils   mkfs.erofs per architecture
    └── guest-platform  guest images per architecture, pushed to ghcr.io
        guest-release   digest-pinned guest index, cosign-signed
        bundle          CLI, daemon, runtime bundle, CLI tarball and SBOM per architecture
        kvm-canary      boots the exact bundle on a self-hosted KVM runner per architecture
        publish         SHA256SUMS, cosign signature, provenance, upload, publish as prerelease
        verify          anonymous download, checksums, signature, attestations
        tuf-beta        points the beta channel at the release
```

Every job builds from the tag, so a failed run can be resumed with **Actions > Release > Run workflow** and the tag. A release that is already published is not modified again; the run only verifies it and continues with `tuf-beta`.

Jobs that change the TUF repository (`tuf-beta`, `promote.yml`, `tuf-refresh.yml`) share the `snapflow-tuf` concurrency group. GitHub keeps one pending job per group, so a queued job can be replaced by a newer one; rerun a cancelled `tuf-beta` job from the run page.

## Release assets

| Asset | Contents |
| --- | --- |
| `snapflow-X.Y.Z-linux-{amd64,arm64}.tar.gz` | The `snapflow` CLI and `THIRD_PARTY_NOTICES.md`, as a reproducible archive. The CLI is the same binary that is inside the runtime bundle. |
| `snapflow-runtime-X.Y.Z-linux-{amd64,arm64}.tar.zst` | The runtime bundle that `snapflow setup` and `snapflow update` install |
| `snapflow-runtime-X.Y.Z-linux-{amd64,arm64}.spdx.json` | SPDX SBOM of everything in the bundle |
| `install.sh` | The installer |
| `SHA256SUMS` | Checksums of every asset above |
| `SHA256SUMS.sigstore.json` | Sigstore bundle for `SHA256SUMS`, signed keylessly by `release.yml` on `main` |

Every asset also has a GitHub build provenance attestation, and GitHub attests the release itself when it is published (Immutable Releases).

## Verifying a download

```sh
v=X.Y.Z
base=https://github.com/snapflowio/snapflow/releases/download/v$v
curl -fsSLO "$base/SHA256SUMS" -O "$base/SHA256SUMS.sigstore.json" -O "$base/snapflow-$v-linux-amd64.tar.gz"

sha256sum --check --ignore-missing SHA256SUMS
cosign verify-blob --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp '^https://github\.com/snapflowio/snapflow/\.github/workflows/release\.yml@refs/heads/main$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  SHA256SUMS
gh attestation verify "snapflow-$v-linux-amd64.tar.gz" --repo snapflowio/snapflow \
  --signer-workflow snapflowio/snapflow/.github/workflows/release.yml
gh release verify "v$v" --repo snapflowio/snapflow
gh release verify-asset "v$v" "snapflow-$v-linux-amd64.tar.gz" --repo snapflowio/snapflow
```

`install.sh` always checks the archive against `SHA256SUMS`, and also checks the cosign signature when `cosign` is installed. Machines verify runtime bundles through TUF: the signed channel document pins each bundle's length and SHA-256.

## Installing

```sh
curl -fsSL https://snapflow.io/install.sh | sh
```

`https://snapflow.io/install.sh` redirects to the `install.sh` of the latest GitHub release, which is always the current stable version. The installer checks for Linux on amd64 or arm64, `/dev/kvm` and systemd, downloads and verifies the CLI, installs `/usr/local/bin/snapflow`, and runs `sudo snapflow setup` when a terminal is attached. Setup installs the runtime bundle from TUF and writes the systemd units; from then on `/usr/local/bin/snapflow` links into the active bundle, so updates replace the CLI too.

| Option | Environment | Meaning |
| --- | --- | --- |
| `--version X.Y.Z` | `SNAPFLOW_VERSION` | Install this CLI release instead of the latest stable one |
| `--channel stable\|beta` | `SNAPFLOW_CHANNEL` | Channel `snapflow setup` follows (default `stable`) |
| `--dry-run` | | Download and verify, then print every change instead of making it |
| `--no-setup` | | Install the CLI only |

Remove Snapflow from a machine with `sudo snapflow uninstall` (see `--purge` in its help).

## Channels and promotion

- **beta**: every release, automatically after its canaries pass. GitHub shows these as prereleases.
- **stable**: a beta release promoted by a person. GitHub's *latest* release is always the stable one.

To promote, run **Actions > Promote to stable** with the version. The job waits for a reviewer of the `stable` environment, re-points the TUF `stable` channel at the already published beta release without rebuilding it, and then marks the GitHub release as latest. Machines move channels with `sudo snapflow update --channel beta|stable`.

## One-time setup

1. **Repository settings**
   - *Settings > General > Releases*: enable **Immutable Releases**.
   - The `snapflowio-automation` GitHub App runs release-please: it opens the release pull request (which starts CI like any other) and creates the `vX.Y.Z` tag, which the tag ruleset allows no one else to do. Its setup is in [CONTRIBUTING.md](../CONTRIBUTING.md#repository-setup).
   - Branch setup (default branch, merge methods, rulesets) is in [CONTRIBUTING.md](../CONTRIBUTING.md#repository-setup).
2. **Environments** (*Settings > Environments*), both limited to the `main` branch. Each is named after the release channel it publishes to, so the repository's deployment history shows every beta release and every promotion to stable:

   | Environment | Reviewers | Secrets |
   | --- | --- | --- |
   | `beta` | none (the pipeline runs unattended; `tuf-refresh.yml` also re-signs with it) | `SNAPFLOW_RELEASE_R2_ACCOUNT_ID`, `SNAPFLOW_RELEASE_R2_ACCESS_KEY_ID`, `SNAPFLOW_RELEASE_R2_SECRET_ACCESS_KEY`, `SNAPFLOW_RELEASE_R2_BUCKET`, `SNAPFLOW_TUF_SNAPSHOT_KEY`, `SNAPFLOW_TUF_TIMESTAMP_KEY`, `SNAPFLOW_TUF_BETA_KEY` |
   | `stable` | required reviewers; turn on *Prevent self-review* once a second maintainer can approve | the four `SNAPFLOW_RELEASE_R2_*` secrets, `SNAPFLOW_TUF_SNAPSHOT_KEY`, `SNAPFLOW_TUF_TIMESTAMP_KEY`, `SNAPFLOW_TUF_STABLE_KEY` |

   Key secrets hold the PEM file contents. Jobs write them to mode `0600` files under `$RUNNER_TEMP` and delete them when the step ends.
3. **Cloudflare R2**: create a bucket, connect the custom domain `releases.snapflow.io` to it, and create an R2 API token with *Object Read & Write* on that bucket only. The bucket holds only `metadata/` and `targets/`; bundles stay on GitHub Releases.
4. **TUF root ceremony**, on an offline machine with a checkout of the tag you trust:

   ```sh
   go run ./apps/snapflow/cmd/snapflow-release tuf init --repository tuf --private-keys keys --policy production
   ```

   The production policy creates three root keys (threshold 2), one targets key, and one key each for snapshot, timestamp, beta and stable. Root and targets keys never leave offline storage: keep each root key on separate encrypted media with a different holder or location, and the targets key with them. Put the snapshot, timestamp, beta and stable keys into the environment secrets above, then delete those local copies (a lost online key is replaced with `tuf resign`). Commit `tuf/metadata/1.root.json` as `apps/snapflow/internal/tuf/trust/root.json`; release builds fail until it is there. Upload the repository as in [Uploading by hand](#uploading-by-hand).
5. **KVM runners**: register one self-hosted runner per architecture on bare metal or a VM with nested virtualization, with the labels `self-hosted`, `linux`, `X64` or `ARM64`, and `snapflow-kvm`. They need `/dev/kvm` and passwordless `sudo`, and should accept only this repository's jobs. Then set the repository variable `SNAPFLOW_KVM_RUNNER_ARCHITECTURES` (*Settings > Secrets and variables > Actions > Variables*) to the registered architectures, for example `["X64"]`; `isolation.yml` is skipped until it is set. The canary works in `/opt/snapflow-canary-*` and removes it afterwards.

## Routine operations

- **Refresh**: `tuf-refresh.yml` runs every six hours. It re-signs timestamp (valid three days), snapshot when it nears its 14-day expiry, and beta once half of its year has passed.
- **Expiry alerts**: the refresh job then fails if root, targets, beta or stable expire within 30 days. A failed refresh run is the alert.
- **Silent stop**: GitHub disables scheduled workflows in a public repository after 60 days without activity, and a disabled schedule produces no failed run. The timestamp is valid for three days, so also monitor `https://releases.snapflow.io/metadata/timestamp.json` from outside GitHub (an uptime check that alerts when its `expires` is under two days away). If the workflow was disabled, re-enable it under *Actions > TUF refresh* and run it once.
- **Stable**: promoting re-signs stable, and promoting the version stable already points at only re-signs it. Run **Promote to stable** with the current stable version at least once a year.
- **Root and targets, yearly**: in an offline ceremony (below), run `tuf resign --repository tuf --role root --key ROOT_KEY_1 --key ROOT_KEY_2` and `tuf resign --repository tuf --role targets --key TARGETS_KEY --snapshot-key SNAPSHOT_KEY --timestamp-key TIMESTAMP_KEY`.
- **Root rotation**: create new keys with `tuf generate-root-keys --output new-keys`, then `tuf rotate-root --repository tuf --current-root-key OLD_1 --current-root-key OLD_2 --new-root-key NEW_1 --new-root-key NEW_2 --new-root-key NEW_3`. Clients follow the chain of root versions, so the embedded root in old CLIs keeps working. Commit the new root as `trust/root.json` so fresh installs start from it.
- **Online key compromise** (snapshot, timestamp, beta or stable): create a key with `tuf generate-key --output NEW.pem` and replace it offline. For snapshot or timestamp: `tuf resign --repository tuf --role root --key ROOT_KEY_1 --key ROOT_KEY_2 --replace snapshot=NEW.pem` (or `timestamp=`). For beta or stable: `tuf resign --repository tuf --role targets --key TARGETS_KEY --replace beta=NEW.pem --snapshot-key SNAPSHOT_KEY --timestamp-key TIMESTAMP_KEY`. Upload, update the GitHub secret, and run **TUF refresh**.
- **Targets or root key compromise**: replace targets with `tuf resign --role root ... --replace targets=NEW.pem`; rotate root with `tuf rotate-root`, dropping the compromised key.

### Uploading by hand

Disable the **TUF refresh** workflow for the duration of a ceremony so it cannot publish over it, and start from the live repository:

```sh
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_R2_ENDPOINT=https://<account id>.r2.cloudflarestorage.com
export RCLONE_CONFIG_R2_ACCESS_KEY_ID=<access key id> RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=<secret access key>
rclone copy --checksum --include "/metadata/**" --include "/targets/**" r2:<bucket> tuf
```

After the ceremony, upload in this order: immutable files first, `timestamp.json` last. `--immutable` refuses to overwrite a published file with different content.

```sh
rclone copy --checksum --immutable --header-upload "Cache-Control: public, max-age=31536000, immutable" tuf/targets r2:<bucket>/targets
rclone copy --checksum --immutable --header-upload "Cache-Control: public, max-age=31536000, immutable" --exclude /timestamp.json tuf/metadata r2:<bucket>/metadata
rclone copyto --checksum --header-upload "Cache-Control: no-store" tuf/metadata/timestamp.json r2:<bucket>/metadata/timestamp.json
```

Then re-enable **TUF refresh**, and update any GitHub secrets whose keys changed.

## Installer contract

Installed machines read the bundle manifest and the TUF channel documents (`targets/channels/<channel>/linux-<arch>.json`) with the CLI they already run. Their schemas are a contract with every CLI in the field: a change to either must first ship in a release whose CLI understands both the old and the new form, and only a later release may start producing the new form. The same applies to the `install.sh` asset names and the `SHA256SUMS` format.
