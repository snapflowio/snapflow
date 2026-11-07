#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Writes the production settlement values (escrow address, its deployment block and the USDC it settles in) from the
# committed deployment registry, apps/contracts/deployments/<chainId>.json, for the chain the values select. With
# --check it changes nothing and fails when the values differ from the registry, or are set without one.
# Run from the workspace root.
#
# Usage: settlement-values.sh [--check]

set -euo pipefail

readonly values="deploy/apps/production/snapflow.yaml"
readonly registry_dir="apps/contracts/deployments"
# The settlement keys sit at this indentation inside the HelmRelease values.
readonly indent="      "

mode="write"
case "${1:-}" in
"") ;;
--check) mode="check" ;;
*)
	echo "usage: settlement-values.sh [--check]" >&2
	exit 2
	;;
esac
readonly mode

value_of() {
	local key="$1" matches
	matches="$(grep -c "^${indent}${key}: " "${values}" || true)"
	if [[ "${matches}" != 1 ]]; then
		echo "error: expected one settlement ${key} in ${values}, found ${matches}" >&2
		exit 1
	fi
	sed -n "s/^${indent}${key}: \"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" "${values}"
}

chain_id="$(value_of chainId)"
for key in escrowAddress escrowDeploymentBlock usdcAddress; do
	value_of "${key}" >/dev/null
done
registry="${registry_dir}/${chain_id}.json"

if [[ ! -f "${registry}" ]]; then
	if [[ "${mode}" == "write" ]]; then
		echo "error: no escrow deployment recorded for chain ${chain_id} in ${registry}" >&2
		exit 1
	fi
	if [[ -n "$(value_of escrowAddress)" || -n "$(value_of escrowDeploymentBlock)" ]]; then
		echo "error: ${values} sets an escrow for chain ${chain_id} without ${registry}; deploy with moon run contracts:deploy-base" >&2
		exit 1
	fi
	echo "No escrow deployed on chain ${chain_id} yet; the settlement values stay empty"
	exit 0
fi

rendered="$(mktemp)"
trap 'rm -f "${rendered}"' EXIT
sed \
	-e "s/^${indent}escrowAddress: .*/${indent}escrowAddress: \"$(jq -r '.escrow.address' "${registry}")\"/" \
	-e "s/^${indent}escrowDeploymentBlock: .*/${indent}escrowDeploymentBlock: \"$(jq -r '.escrow.blockNumber' "${registry}")\"/" \
	-e "s/^${indent}usdcAddress: .*/${indent}usdcAddress: \"$(jq -r '.escrow.constructorArgs.token' "${registry}")\"/" \
	"${values}" >"${rendered}"

if [[ "${mode}" == "check" ]]; then
	if ! diff -u "${values}" "${rendered}"; then
		echo "error: the settlement values differ from ${registry}; run bash deploy/scripts/settlement-values.sh" >&2
		exit 1
	fi
	echo "The settlement values match ${registry}"
else
	cat "${rendered}" >"${values}"
	echo "Wrote the settlement values for chain ${chain_id} from ${registry} to ${values}"
fi
