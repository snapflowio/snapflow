#!/usr/bin/env bash
set -euo pipefail

if ! command -v nvidia-smi >/dev/null 2>&1; then
	if [[ "${SNAPFLOW_REQUIRE_NVIDIA_GPU:-false}" == "true" ]]; then
		printf 'error: an NVIDIA GPU was required but is not visible in this devcontainer\n' >&2
		printf 'error: verify the Windows NVIDIA driver and Docker Desktop GPU support, then rebuild the GPU devcontainer\n' >&2
		exit 1
	fi

	printf 'note: no NVIDIA GPU is visible in this devcontainer\n'
	exit 0
fi

nvidia-smi --query-gpu=name,uuid,pci.bus_id,driver_version,memory.total --format=csv,noheader

if [[ ! -d /sys/kernel/iommu_groups ]] || ! compgen -G '/sys/kernel/iommu_groups/*' >/dev/null; then
	printf 'warning: IOMMU groups are unavailable; exclusive GPU passthrough cannot run here\n' >&2
	exit 0
fi

if [[ ! -e /dev/vfio/vfio ]]; then
	printf 'warning: /dev/vfio/vfio is unavailable; expose VFIO to run GPU microVMs here\n' >&2
	exit 0
fi

printf 'exclusive GPU passthrough prerequisites are visible; the node will validate complete IOMMU groups before advertising GPUs\n'
