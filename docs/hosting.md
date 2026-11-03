# Hosting

Hosts list their own machines and Snapflow schedules customer sandboxes on them. Every sandbox is a microVM. This page lists what a machine needs, what Snapflow sets up on it, and how to check it before listing. Installation is described in [releases.md](releases.md#installing).

## Requirements

| Requirement | Detail |
| --- | --- |
| Operating system | Linux on x86_64 or arm64 with KVM (`/dev/kvm`). macOS is not supported. |
| Kernel | 6.2 or newer with Landlock enabled. Cloud Hypervisor always runs under Landlock. |
| systemd | With D-Bus. Every microVM runs in its own transient scope `snapflow-vm-<id>.scope` under `snapflow-vms.slice`, so sandboxes keep running when the daemon restarts. |
| cgroup v2 | The unified hierarchy |
| nftables | Sandbox networking and isolation rules |
| IPv4 forwarding | Enabled |
| KSM | Off. Kernel same-page merging lets tenants observe each other's memory through timing. |

### Storage

Keep the data directory `/var/lib/snapflow` on XFS formatted with `reflink=1`, or on Btrfs, so images and volumes are cloned instantly. Other filesystems work, but every clone is a full copy and volume files are preallocated.

Volumes live on the machine's local disk. No Ceph or other storage cluster is needed: running sandboxes' volumes are backed up off the machine (see [Volumes and backups](#volumes-and-backups)).

### GPUs

A GPU is passed through whole, together with the rest of its IOMMU group, to one sandbox at a time.

- IOMMU enabled in firmware and on the kernel command line
- The NVIDIA driver installed (`nvidia-smi` and `libcuda.so.1`)
- `nvidia-drm` loaded with `modeset=0`
- `nvidia-persistenced` not running

When a sandbox releases a GPU, Snapflow resets it, checks its health with `nvidia-smi` and scrubs its memory. A GPU that fails any step is quarantined and removed from the listing until the machine reboots.

## Isolation

Snapflow applies all of the following itself; there is nothing to configure.

- **Network**: each sandbox has its own network namespace. It can reach the internet, but not the machine, the machine's local network, cloud metadata (`169.254.169.254`) or other sandboxes unless the customer links them. Spoofed source IP and MAC addresses are dropped, and IPv6 is off for sandboxes.
- **Firewall**: Snapflow works alongside Docker, UFW or plain iptables, and firewalld without manual rules.
- **Hypervisor jail**: each hypervisor process runs under its own uid with no capabilities, `no_new_privs`, seccomp, Landlock, private mount, PID, IPC and UTS namespaces, and access to its own files only.
- **Resources**: each sandbox has CPU, memory, process and disk I/O limits, and is pinned to whole physical CPU cores so tenants never share SMT siblings.
- **Registry access**: the machine receives a short-lived token scoped to each job instead of a shared registry password.

Isolation protects the machine from sandboxes and sandboxes from each other. It does not hide sandboxes from the host operating the machine, and customers are told so in the terms of service.

## Volumes and backups

Volumes of running sandboxes are backed up incrementally and encrypted with AES-256-GCM, every 15 minutes by default (`SNAPFLOW_VOLUME_BACKUP_INTERVAL_SECONDS` on the api, see [api-environment.md](reference/api-environment.md)). If a machine fails, a volume can be restored onto another machine, losing at most one interval of writes.

## Checking a machine

```sh
sudo snapflow doctor
```

checks the machine before it is listed, including the kernel and Landlock, KSM, CPU vulnerability mitigations and, on GPU machines, the GPU prerequisites.

```sh
sudo snapflow doctor --isolation
```

proves the isolation walls described above on the machine itself. Run it while Snapflow is stopped, before the machine is listed.

## Host responsibilities

- Do not inspect, copy or tamper with customer workloads or their data.
- Keep the required settings in place (KSM off, IOMMU on for GPUs and the rest of [Requirements](#requirements)) and do not disable or work around Snapflow's isolation.
