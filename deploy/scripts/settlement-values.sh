#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

readonly values="deploy/apps/production/api/release.yaml"
readonly registry_dir="apps/contracts/deployments"
readonly settlement=".spec.values.settlement"
readonly required_keys='["chainId", "escrowAddress", "escrowDeploymentBlock", "usdcAddress", "relayerAddress", "feeReceiverAddress"]'
readonly registry_fields='[.escrow.address, .escrow.blockNumber, .escrow.feeReceiver, .escrow.constructorArgs.token, .escrow.constructorArgs.roles.guardian]'
readonly render="load(strenv(REGISTRY)) as \$registry |
with(${settlement};
  .escrowAddress = (\$registry.escrow.address | tostring) |
  .escrowDeploymentBlock = (\$registry.escrow.blockNumber | tostring) |
  .usdcAddress = (\$registry.escrow.constructorArgs.token | tostring) |
  .relayerAddress = (\$registry.escrow.constructorArgs.roles.guardian | tostring) |
  .feeReceiverAddress = (\$registry.escrow.feeReceiver | tostring) |
  (.escrowAddress, .escrowDeploymentBlock, .usdcAddress, .relayerAddress, .feeReceiverAddress) style=\"double\"
)"

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

if ! REQUIRED="${required_keys}" yq --exit-status "${settlement} as \$s | (strenv(REQUIRED) | from_json | all_c(. as \$key | \$s | has(\$key)))" "${values}" >/dev/null 2>&1; then
	echo "error: ${values} must set ${required_keys} under ${settlement}" >&2
	exit 1
fi

chain_id="$(yq "${settlement}.chainId" "${values}")"
registry="${registry_dir}/${chain_id}.json"
if [[ ! -f "${registry}" ]]; then
	if [[ "${mode}" == "write" ]]; then
		echo "error: no escrow deployment recorded for chain ${chain_id} in ${registry}" >&2
		exit 1
	fi
	if [[ -n "$(yq "${settlement}.escrowAddress" "${values}")" || -n "$(yq "${settlement}.escrowDeploymentBlock" "${values}")" ]]; then
		echo "error: ${values} sets an escrow for chain ${chain_id} without ${registry}; deploy with moon run contracts:deploy-base" >&2
		exit 1
	fi
	echo "No escrow deployed on chain ${chain_id} yet; the settlement values stay empty"
	exit 0
fi

if ! yq --exit-status "${registry_fields} | all_c(. != null)" "${registry}" >/dev/null 2>&1; then
	echo "error: ${registry} is missing the escrow address, block, fee receiver, token or guardian" >&2
	exit 1
fi

export REGISTRY="${registry}"
if [[ "${mode}" == "check" ]]; then
	if ! diff -u "${values}" <(yq "${render}" "${values}"); then
		echo "error: the settlement values differ from ${registry}; run bash deploy/scripts/settlement-values.sh" >&2
		exit 1
	fi
	echo "The settlement values match ${registry}"
else
	yq --inplace "${render}" "${values}"
	echo "Wrote the settlement values for chain ${chain_id} from ${registry} to ${values}"
fi
