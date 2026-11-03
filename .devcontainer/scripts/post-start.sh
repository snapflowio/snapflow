#!/usr/bin/env bash
set -euo pipefail

verify_service() {
	local description="$1"
	shift

	if ! "$@"; then
		printf 'error: %s is unavailable; rebuild the Snapflow development container\n' \
			"$description" >&2
		exit 1
	fi
}

mount_machine_workloads() {
	local data_dir=/var/lib/snapflow-development
	local image="$data_dir/workloads.xfs"
	local mountpoint="$data_dir/workloads"

	if [[ ! -e "$image" ]]; then
		sudo truncate --size=256G "$image"
		sudo mkfs.xfs -q -m reflink=1 "$image"
	fi
	sudo install -d "$mountpoint"
	if ! mountpoint -q "$mountpoint"; then
		sudo mount -o loop,noatime "$image" "$mountpoint"
	fi
	sudo fstrim "$mountpoint"
}

reflink_supported() {
	local probe
	probe="$(sudo mktemp -p /var/lib/snapflow-development/workloads)"
	local status=0
	sudo cp --reflink=always "$probe" "$probe.clone" || status=$?
	sudo rm -f "$probe" "$probe.clone"
	return "$status"
}

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

if [[ ! -r .tmp/openbao/tunnel-client-ca.pem || ! -s .tmp/openbao/tunnel-client-ca.pem ]]; then
	printf '%s\n' \
		'error: OpenBao PKI did not export .tmp/openbao/tunnel-client-ca.pem; rebuild the Snapflow development container' >&2
	exit 1
fi

bash .devcontainer/scripts/configure-node-runtime.sh
bash .devcontainer/scripts/verify-gpu-runtime.sh
