#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Builds the saved anvil state the dev stack's anvil service boots from: CreateX at its canonical address, the mock
# USDC and the escrow at their deterministic addresses, and USDC for every anvil dev account. It runs DeployLocal
# against a private anvil, records the escrow in deployments/31337.json and dumps the chain into the state file.
# Run from apps/contracts (moon run contracts:dev-chain-state).
#
# Environment: DEV_CHAIN_PORT (a free local port for the private anvil), DEV_CHAIN_STATE_FILE (where to write the
# state), ESCROW_FEE_CAP_BPS, ESCROW_DISPUTE_WINDOW_SECONDS, LOCAL_FUNDING_AMOUNT.

set -euo pipefail

readonly port="${DEV_CHAIN_PORT:?set DEV_CHAIN_PORT}"
readonly state_file="${DEV_CHAIN_STATE_FILE:?set DEV_CHAIN_STATE_FILE}"
readonly rpc_url="http://127.0.0.1:${port}"
readonly chain_id=31337
readonly deploy_script="DeployLocal.s.sol"
# anvil's first two default accounts: the deployer holds every escrow role, the second receives the fees.
readonly deployer_index=0
readonly fee_recipient_index=1
readonly startup_attempts=50
readonly startup_interval_seconds=0.2

work_dir="$(mktemp -d)"
readonly work_dir
anvil_pid=""
cleanup() {
	if [[ -n "${anvil_pid}" ]] && kill -0 "${anvil_pid}" 2>/dev/null; then
		kill "${anvil_pid}"
		wait "${anvil_pid}" || true
	fi
	rm -rf "${work_dir}"
}
trap cleanup EXIT

anvil --port "${port}" --chain-id "${chain_id}" --dump-state "${work_dir}/state.json" --silent &
anvil_pid=$!
for ((attempt = 0; attempt < startup_attempts; attempt++)); do
	cast chain-id --rpc-url "${rpc_url}" >/dev/null 2>&1 && break
	sleep "${startup_interval_seconds}"
done
cast chain-id --rpc-url "${rpc_url}" >/dev/null

mapfile -t accounts < <(cast rpc eth_accounts --rpc-url "${rpc_url}" | jq -r '.[]')
accounts_csv="$(IFS=,; echo "${accounts[*]}")"

ESCROW_FEE_RECIPIENT="${accounts[fee_recipient_index]}" LOCAL_FUNDED_ACCOUNTS="${accounts_csv}" \
	forge script "script/${deploy_script}" --rpc-url "${rpc_url}" --broadcast --unlocked \
	--sender "${accounts[deployer_index]}"
bash script/record-deployment.sh "${deploy_script}" "${chain_id}"

# anvil writes --dump-state when it exits.
kill -INT "${anvil_pid}"
wait "${anvil_pid}"
anvil_pid=""
mkdir -p "$(dirname "${state_file}")"
jq -c . "${work_dir}/state.json" >"${state_file}"
echo "Wrote the dev chain state to ${state_file}"
