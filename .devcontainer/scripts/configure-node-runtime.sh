#!/usr/bin/env bash
set -euo pipefail

node_user="${SUDO_USER:-${USER:-vscode}}"
cgroup_root="/sys/fs/cgroup"
cgroup_controller="pids"
controllers_file="${cgroup_root}/cgroup.controllers"
subtree_control_file="${cgroup_root}/cgroup.subtree_control"
init_scope_procs_file="${cgroup_root}/init.scope/cgroup.procs"
delegation_attempts=3

move_to_init_scope() {
	local pid="$1"
	if printf '%s\n' "$pid" | sudo tee "$init_scope_procs_file" >/dev/null 2>&1; then
		return
	fi
	if [[ -e "/proc/${pid}" ]]; then
		printf 'error: failed to move process %s out of the cgroup root\n' "$pid" >&2
		exit 1
	fi
}

evacuate_cgroup_root() {
	local pid pids
	move_to_init_scope "$BASHPID"
	mapfile -t pids <"${cgroup_root}/cgroup.procs"
	for pid in "${pids[@]}"; do
		move_to_init_scope "$pid"
	done
}

enable_root_controllers() {
	local controllers attempt
	controllers="$(sed -e 's/^/+/' -e 's/ / +/g' "$controllers_file")"
	for ((attempt = 1; attempt <= delegation_attempts; attempt++)); do
		evacuate_cgroup_root
		if printf '%s\n' "$controllers" | sudo tee "$subtree_control_file" >/dev/null 2>&1; then
			return
		fi
	done
}

configure_firecracker_cgroup() {
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
	enable_root_controllers
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
