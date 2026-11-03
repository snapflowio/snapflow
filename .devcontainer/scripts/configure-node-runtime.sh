#!/usr/bin/env bash
set -euo pipefail

node_user="${SUDO_USER:-${USER:-vscode}}"
cgroup_root="/sys/fs/cgroup"
cgroup_controller="pids"

configure_firecracker_cgroup() {
	local controllers_file="${cgroup_root}/cgroup.controllers"
	local subtree_control_file="${cgroup_root}/cgroup.subtree_control"
	if [[ ! -r "$controllers_file" || ! -e "$subtree_control_file" ]]; then
		printf 'warning: cgroup v2 delegation is unavailable; production Firecracker isolation cannot be qualified\n' >&2
		return
	fi
	if ! grep -qw "$cgroup_controller" "$controllers_file"; then
		printf 'warning: cgroup v2 does not expose the %s controller; production Firecracker isolation cannot be qualified\n' \
			"$cgroup_controller" >&2
		return
	fi
	if grep -qw "$cgroup_controller" "$subtree_control_file"; then
		return
	fi
	printf '+%s\n' "$cgroup_controller" | sudo tee "$subtree_control_file" >/dev/null
	if ! grep -qw "$cgroup_controller" "$subtree_control_file"; then
		printf 'error: failed to delegate the cgroup v2 %s controller\n' \
			"$cgroup_controller" >&2
		exit 1
	fi
}

grant_device_access() {
	local path="$1"
	local description="$2"

	if [[ ! -e "$path" ]]; then
		printf 'warning: %s is unavailable (%s)\n' "$path" "$description" >&2
		return
	fi

	if command -v setfacl >/dev/null 2>&1; then
		sudo setfacl -m "u:${node_user}:rw" "$path"
	else
		printf 'warning: setfacl is unavailable; granting read/write access to %s (%s)\n' \
			"$path" "$description" >&2
		sudo chmod a+rw "$path"
	fi
}

grant_device_access /dev/kvm "Firecracker and Cloud Hypervisor require nested KVM"
grant_device_access /dev/net/tun "microVM networking requires TUN/TAP"
configure_firecracker_cgroup

if [[ -e /dev/vfio/vfio ]]; then
	grant_device_access /dev/vfio/vfio "VFIO control device"
	while IFS= read -r vfio_group; do
		grant_device_access "$vfio_group" "VFIO IOMMU group"
	done < <(find /dev/vfio -maxdepth 1 -type c ! -name vfio -print 2>/dev/null | sort)
fi

sudo sysctl -w net.ipv4.ip_forward=1 >/dev/null

sudo systemd-creds setup
