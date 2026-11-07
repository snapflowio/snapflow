#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Records the escrow a broadcast deploy script created in deployments/<chainId>.json, the committed registry that
# production values and the local dev chain are generated from. Run from apps/contracts after
# `forge script <script> --broadcast`.
#
# Usage: record-deployment.sh <script file name> <chain id>

set -euo pipefail

readonly script_name="${1:?usage: record-deployment.sh <script file name> <chain id>}"
readonly chain_id="${2:?usage: record-deployment.sh <script file name> <chain id>}"
readonly broadcast="${FOUNDRY_BROADCAST:-broadcast}/${script_name}/${chain_id}/run-latest.json"
readonly registry="deployments/${chain_id}.json"
readonly createx="0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed"
readonly create3_function="deployCreate3(bytes32,bytes)"
# SnapflowEscrow's constructor; its ABI-encoded arguments are the last five words of the init code.
readonly constructor_signature="constructor(address,address,address,uint16,uint64)"
readonly constructor_words=5
readonly word_hex_length=64

if [[ ! -f "${broadcast}" ]]; then
	echo "error: no broadcast at ${broadcast}; run the deploy script with --broadcast first" >&2
	exit 1
fi

escrow="$(jq -re '.returns.escrow.value' "${broadcast}")"
transaction="$(jq -ce --arg escrow "${escrow,,}" --arg createx "${createx,,}" --arg function "${create3_function}" '
	[.transactions[] | select(
		(.transaction.to // "" | ascii_downcase) == $createx and .function == $function and
		any(.additionalContracts[]; (.address | ascii_downcase) == $escrow)
	)] | if length == 1 then .[0] else error("expected one CreateX transaction creating the escrow") end
' "${broadcast}")"
transaction_hash="$(jq -r '.hash' <<<"${transaction}")"
receipt="$(jq -ce --arg hash "${transaction_hash}" '
	.receipts[] | select(.transactionHash == $hash and .status == "0x1")
' "${broadcast}")"

init_code="$(jq -r '.arguments[1]' <<<"${transaction}")"
encoded_arguments="${init_code: -$((constructor_words * word_hex_length))}"
mapfile -t arguments < <(cast decode-abi --input "${constructor_signature}" "0x${encoded_arguments}")

mkdir -p "$(dirname "${registry}")"
jq -n --tab \
	--argjson chainId "${chain_id}" \
	--arg commit "$(git rev-parse HEAD)" \
	--arg createX "${createx}" \
	--arg address "$(cast to-check-sum-address "${escrow}")" \
	--arg deployer "$(cast to-check-sum-address "$(jq -r '.transaction.from' <<<"${transaction}")")" \
	--arg salt "$(jq -r '.arguments[0]' <<<"${transaction}")" \
	--arg transactionHash "${transaction_hash}" \
	--argjson blockNumber "$(cast to-dec "$(jq -r '.blockNumber' <<<"${receipt}")")" \
	--arg token "${arguments[0]}" \
	--arg admin "${arguments[1]}" \
	--arg feeRecipient "${arguments[2]}" \
	--argjson feeCapBps "${arguments[3]}" \
	--argjson disputeWindow "${arguments[4]}" \
	'{
		chainId: $chainId,
		commit: $commit,
		createX: $createX,
		escrow: {
			address: $address,
			deployer: $deployer,
			salt: $salt,
			transactionHash: $transactionHash,
			blockNumber: $blockNumber,
			constructorArgs: {
				token: $token,
				admin: $admin,
				feeRecipient: $feeRecipient,
				feeCapBps: $feeCapBps,
				disputeWindow: $disputeWindow
			}
		}
	}' >"${registry}"
echo "Recorded SnapflowEscrow ${escrow} on chain ${chain_id} in apps/contracts/${registry}"
