<br />
<div align="center">
  <a href="https://github.com/snapflowio/snapflow">
    <img src="assets/logo.svg" alt="Snapflow" width="64" height="64">
  </a>

<h3 align="center">Snapflow</h3>
  <p align="center">
    Deploy apps. Powered by many.
    <br />
    <a href="https://snapflow.io/docs"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://snapflow.io">Website</a>
    &middot;
    <a href="https://github.com/snapflowio/snapflow/issues/new?labels=bug&template=bug_report.md">Report Bug</a>
    &middot;
    <a href="https://github.com/snapflowio/snapflow/issues/new?labels=enhancement&template=feature_request.md">Request Feature</a>
  </p>
</div>

## Host a machine

Run this on a Linux machine (amd64 or arm64) with KVM and systemd:

```sh
curl -fsSL https://snapflow.io/install.sh | sh
```

The installer verifies the CLI against `SHA256SUMS` (and its cosign signature when `cosign` is installed), installs `/usr/local/bin/snapflow` and runs `sudo snapflow setup`, which installs the runtime from the signed TUF repository at `releases.snapflow.io`. Options: `--version X.Y.Z`, `--channel stable|beta` (default `stable`), `--dry-run`, `--no-setup`. Switch channels later with `sudo snapflow update --channel beta|stable`; remove Snapflow with `sudo snapflow uninstall`.

### Requirements

| Requirement | Detail |
| --- | --- |
| Operating system | Linux on x86_64 or arm64 with KVM (`/dev/kvm`) |
| Kernel | 6.2 or newer with Landlock enabled |
| systemd | With D-Bus; sandboxes keep running when the daemon restarts |
| cgroup v2, nftables | The unified hierarchy; nftables for sandbox networking |
| IPv4 forwarding | Enabled |
| KSM | Off: same-page merging lets tenants observe each other's memory |
| Storage | `/var/lib/snapflow` on XFS with `reflink=1` or Btrfs for instant clones; other filesystems copy in full |
| GPUs (optional) | IOMMU on in firmware and the kernel command line, the NVIDIA driver, `nvidia-drm` with `modeset=0`, `nvidia-persistenced` stopped. Each GPU goes to one sandbox at a time with its IOMMU group, and is reset, health-checked and scrubbed after use. |

Snapflow sets up sandbox isolation itself (a network namespace per sandbox without access to the machine or its network, jailed hypervisors, CPU, memory and I/O limits on whole cores, per-job registry tokens) and works alongside Docker, UFW and firewalld. Check a machine before listing it with `sudo snapflow doctor`, and prove its isolation with `sudo snapflow doctor --isolation` while Snapflow is stopped. Hosts must not inspect or tamper with customer workloads, and must keep these settings in place.

### Verifying a download

```sh
v=X.Y.Z
base=https://github.com/snapflowio/snapflow/releases/download/v$v
curl -fsSLO "$base/SHA256SUMS" -O "$base/SHA256SUMS.sigstore.json" -O "$base/snapflow-$v-linux-amd64.tar.gz"
sha256sum --check --ignore-missing SHA256SUMS
cosign verify-blob --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp '^https://github\.com/snapflowio/snapflow/\.github/workflows/release\.yml@refs/heads/main$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com SHA256SUMS
gh attestation verify "snapflow-$v-linux-amd64.tar.gz" --repo snapflowio/snapflow \
  --signer-workflow snapflowio/snapflow/.github/workflows/release.yml
```

### Top contributors:

<a href="https://github.com/snapflowio/snapflow/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=snapflowio/snapflow" />
</a>

## Stargazers
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=snapflowio/snapflow&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=snapflowio/snapflow&type=Date" />
  <img alt="Star History Chart" src="https://api.star-history.com/image?repos=snapflowio/snapflow&type=Date" />
</picture>

## License

Distributed under the `AGPLv3`. See `LICENSE` for more information.