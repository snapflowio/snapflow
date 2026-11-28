#!/usr/bin/env bash
set -euo pipefail

local_chain_rpc_url=http://anvil:8545

verify_service() {
	local description="$1"
	shift

	if ! "$@"; then
		printf 'error: %s is unavailable; rebuild the Snapflow development container\n' \
			"$description" >&2
		exit 1
	fi
}

wait_for_systemd() {
	local state
	state="$(sudo systemctl is-system-running --wait)" && return 0
	if [[ "$state" != "degraded" ]]; then
		printf 'error: systemd finished booting as %s\n' "$state" >&2
		return 1
	fi
	printf 'warning: systemd is degraded; failed units:\n' >&2
	systemctl --failed --no-legend --plain >&2
}

mount_machine_workloads() {
	local data_dir=/var/lib/snapflow-development
	local image="$data_dir/workloads.xfs"
	local mountpoint="$data_dir/workloads"

	if [[ ! -e "$image" ]]; then
		sudo truncate --size=96G "$image"
		sudo mkfs.xfs -q -m reflink=1 "$image"
	fi
	sudo install -d "$mountpoint"
	if ! mountpoint -q "$mountpoint"; then
		sudo mount -o loop,noatime "$image" "$mountpoint"
	fi
	sudo fstrim "$mountpoint"
}

sync_local_chain_clock() {
	local chain_time now
	chain_time="$(cast block latest --field timestamp --rpc-url "$local_chain_rpc_url")"
	now="$(date +%s)"
	if ((chain_time < now)); then
		cast rpc evm_setTime "$now" --rpc-url "$local_chain_rpc_url" >/dev/null
		cast rpc evm_mine --rpc-url "$local_chain_rpc_url" >/dev/null
	fi
}

reflink_supported() {
	local probe
	probe="$(sudo mktemp -p /var/lib/snapflow-development/workloads)"
	local status=0
	sudo cp --reflink=always "$probe" "$probe.clone" || status=$?
	sudo rm -f "$probe" "$probe.clone"
	return "$status"
}

verify_service "systemd" wait_for_systemd
mount_machine_workloads
verify_service "machine reflink workload storage" reflink_supported

verify_service "PostgreSQL" \
	pg_isready --host=postgres --port=5432 --username=snapflow --dbname=snapflow
verify_service "Redis" redis-cli -h redis ping
verify_service "local registry" curl --fail --silent --show-error http://registry:5000/v2/
verify_service "BuildKit" buildctl debug workers
verify_service "developer Docker daemon" docker info --format '{{.ServerVersion}}'
verify_service "Docker Buildx" docker buildx version
verify_service "OpenBao" \
	curl --fail --silent --show-error http://openbao:8200/v1/sys/health
verify_service "OpenBao Proxy" \
	curl --fail --silent --show-error \
	--header 'X-Vault-Request: true' \
	--output /dev/null \
	http://openbao-proxy:8201/v1/auth/token/lookup-self
verify_service "Resend emulator" \
	curl --fail --silent --show-error --output /dev/null http://resend:4008/emails
verify_service "local settlement chain" \
	cast chain-id --rpc-url "$local_chain_rpc_url"
verify_service "local settlement chain clock" sync_local_chain_clock
verify_service "local settlement contracts" \
	pnpm exec moon run contracts:deploy-local

if [[ ! -r .tmp/openbao/tunnel-client-ca.pem || ! -s .tmp/openbao/tunnel-client-ca.pem ]]; then
	printf '%s\n' \
		'error: OpenBao PKI did not export .tmp/openbao/tunnel-client-ca.pem; rebuild the Snapflow development container' >&2
	exit 1
fi

bash .devcontainer/scripts/configure-node-runtime.sh
bash .devcontainer/scripts/verify-gpu-runtime.sh
