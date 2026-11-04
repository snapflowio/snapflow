# Release trust root

Release builds embed `root.json` from this directory as the TUF bootstrap root.
It is the public `metadata/1.root.json` produced by `snapflow-release tuf init --policy production`.
Machines receive releases through the TUF repository at `https://releases.snapflow.io`
(bucket holds only `metadata/` and `targets/`; bundles stay on GitHub Releases).

## Channels

- **beta**: every release, automatically after its KVM canaries pass (`release.yml`). GitHub shows these as prereleases.
- **stable**: a beta release promoted with **Actions > Promote to stable**, which waits for a `stable` environment reviewer, re-points the channel without rebuilding and marks the GitHub release as latest.

Machines switch with `sudo snapflow update --channel beta|stable`.

## One-time setup

1. *Settings > General > Releases*: enable **Immutable Releases**.
2. Environments, both limited to `main`:

   | Environment | Reviewers | Secrets |
   | --- | --- | --- |
   | `beta` | none (unattended; `tuf-refresh.yml` also signs with it) | `SNAPFLOW_RELEASE_R2_ACCOUNT_ID`, `SNAPFLOW_RELEASE_R2_ACCESS_KEY_ID`, `SNAPFLOW_RELEASE_R2_SECRET_ACCESS_KEY`, `SNAPFLOW_RELEASE_R2_BUCKET`, `SNAPFLOW_TUF_SNAPSHOT_KEY`, `SNAPFLOW_TUF_TIMESTAMP_KEY`, `SNAPFLOW_TUF_BETA_KEY` |
   | `stable` | required; turn on *Prevent self-review* once a second maintainer can approve | the four `SNAPFLOW_RELEASE_R2_*` secrets, `SNAPFLOW_TUF_SNAPSHOT_KEY`, `SNAPFLOW_TUF_TIMESTAMP_KEY`, `SNAPFLOW_TUF_STABLE_KEY` |

   Key secrets hold PEM file contents; jobs write them to mode `0600` files under `$RUNNER_TEMP` and delete them after the step.
3. Cloudflare R2: a bucket with the custom domain `releases.snapflow.io`, and an R2 API token with *Object Read & Write* on that bucket only.
4. TUF root ceremony, on an offline machine with a checkout of the tag you trust:

   ```sh
   go run ./apps/snapflow/cmd/snapflow-release tuf init --repository tuf --private-keys keys --policy production
   ```

   This creates three root keys (threshold 2), one targets key and one key each for snapshot, timestamp, beta and stable. Root and targets keys never leave offline storage: each root key on separate encrypted media with a different holder or location, the targets key with them. Put the snapshot, timestamp, beta and stable keys into the environment secrets, then delete those local copies (a lost online key is replaced with `tuf resign`). Commit `tuf/metadata/1.root.json` here as `root.json`; release builds fail until it is present. Upload the repository as below.
5. KVM runners: one self-hosted runner per architecture on bare metal or a VM with nested virtualization, labelled `self-hosted`, `linux`, `X64` or `ARM64`, and `snapflow-kvm`, with `/dev/kvm` and passwordless `sudo`, accepting only this repository's jobs. Set the repository variable `SNAPFLOW_KVM_RUNNER_ARCHITECTURES` to the registered architectures, for example `["X64"]`; `isolation.yml` is skipped until then.

## Routine operations

- `tuf-refresh.yml` runs every six hours: it re-signs timestamp (valid three days), snapshot near its 14-day expiry and beta halfway through its year, and fails if root, targets, beta or stable expire within 30 days.
- GitHub disables scheduled workflows in a public repository after 60 days without activity, silently. Monitor `https://releases.snapflow.io/metadata/timestamp.json` from outside GitHub and alert when its `expires` is under two days away; re-enable **TUF refresh** and run it once if it stopped.
- Run **Promote to stable** with the current stable version at least once a year to re-sign stable.
- Root and targets, yearly, offline: `tuf resign --repository tuf --role root --key ROOT_KEY_1 --key ROOT_KEY_2` and `tuf resign --repository tuf --role targets --key TARGETS_KEY --snapshot-key SNAPSHOT_KEY --timestamp-key TIMESTAMP_KEY`.
- Root rotation: `tuf generate-root-keys --output new-keys`, then `tuf rotate-root --repository tuf --current-root-key OLD_1 --current-root-key OLD_2 --new-root-key NEW_1 --new-root-key NEW_2 --new-root-key NEW_3`, and commit the new root here.
- Online key compromise (snapshot, timestamp, beta or stable): `tuf generate-key --output NEW.pem`, then offline `tuf resign --repository tuf --role root --key ROOT_KEY_1 --key ROOT_KEY_2 --replace snapshot=NEW.pem` (or `timestamp=`), or for beta and stable `tuf resign --repository tuf --role targets --key TARGETS_KEY --replace beta=NEW.pem --snapshot-key SNAPSHOT_KEY --timestamp-key TIMESTAMP_KEY`. Upload, update the GitHub secret and run **TUF refresh**. A compromised targets key is replaced through `--role root ... --replace targets=NEW.pem`; a compromised root key is dropped with `tuf rotate-root`.

## Uploading by hand

Disable **TUF refresh** during a ceremony and start from the live repository:

```sh
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_R2_ENDPOINT=https://<account id>.r2.cloudflarestorage.com
export RCLONE_CONFIG_R2_ACCESS_KEY_ID=<access key id> RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=<secret access key>
rclone copy --checksum --include "/metadata/**" --include "/targets/**" r2:<bucket> tuf
```

Afterwards upload immutable files first and `timestamp.json` last, then re-enable **TUF refresh**:

```sh
rclone copy --checksum --immutable --header-upload "Cache-Control: public, max-age=31536000, immutable" tuf/targets r2:<bucket>/targets
rclone copy --checksum --immutable --header-upload "Cache-Control: public, max-age=31536000, immutable" --exclude /timestamp.json tuf/metadata r2:<bucket>/metadata
rclone copyto --checksum --header-upload "Cache-Control: no-store" tuf/metadata/timestamp.json r2:<bucket>/metadata/timestamp.json
```

## Compatibility contract

Installed machines read the bundle manifest and the channel documents (`targets/channels/<channel>/linux-<arch>.json`) with the CLI they already run. A schema change must first ship in a release whose CLI understands both forms; only a later release may produce the new form. The same holds for the `install.sh` asset names and the `SHA256SUMS` format.
