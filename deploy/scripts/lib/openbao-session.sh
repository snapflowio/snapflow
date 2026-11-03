#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

readonly openbao_namespace="openbao"
readonly openbao_service="openbao"
readonly openbao_service_port=8200
readonly openbao_local_port=18200
readonly openbao_login_role="snapflow-configure"
readonly openbao_service_account="snapflow-openbao-configure"
readonly openbao_token_audience="openbao"
readonly openbao_token_duration="15m"
readonly openbao_ready_attempts=30
readonly openbao_ready_interval_seconds=1

openbao_session_open() {
	kubectl --namespace "${openbao_namespace}" port-forward "service/${openbao_service}" "${openbao_local_port}:${openbao_service_port}" >/dev/null &
	openbao_port_forward=$!
	trap 'kill "${openbao_port_forward}"' EXIT

	export BAO_ADDR="http://127.0.0.1:${openbao_local_port}"
	local attempt
	for ((attempt = 1; attempt <= openbao_ready_attempts; attempt++)); do
		bao status >/dev/null 2>&1 && break
		if ((attempt == openbao_ready_attempts)); then
			echo "OpenBao is not reachable or is sealed at ${BAO_ADDR}" >&2
			exit 1
		fi
		sleep "${openbao_ready_interval_seconds}"
	done

	local jwt
	jwt="$(kubectl --namespace "${openbao_namespace}" create token "${openbao_service_account}" --audience "${openbao_token_audience}" --duration "${openbao_token_duration}")"
	BAO_TOKEN="$(bao write -field=token "auth/kubernetes/login" role="${openbao_login_role}" jwt="${jwt}")"
	export BAO_TOKEN
}
