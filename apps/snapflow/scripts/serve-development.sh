#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

: "${SNAPFLOW_DEVELOPMENT_MACHINE_ENROLLMENT_SECRET:?SNAPFLOW_DEVELOPMENT_MACHINE_ENROLLMENT_SECRET must be set (apps/snapflow/.env)}"

app_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly app_root
workspace_root="$(cd -- "${app_root}/../.." && pwd -P)"
readonly workspace_root
readonly unit_file="${app_root}/internal/foundation/system/files/snapflow.service"
readonly unit_name="snapflow-development.service"
readonly daemon="/opt/snapflow-development/current/bin/snapflowd"
readonly edge_ca="${workspace_root}/.tmp/edge/tls/edge-server-ca.pem"
readonly offered_vcpus=8
readonly offered_memory_gib=6
readonly offered_disk_gib=56
readonly skipped_settings='^(Environment|ExecStart|WorkingDirectory|StateDirectory|StateDirectoryMode|RuntimeDirectory|RuntimeDirectoryMode|RuntimeDirectoryPreserve|Restart|RestartSec|RestartSteps|RestartMaxDelaySec|StandardOutput|StandardError)='

properties=()
while IFS= read -r setting; do
	properties+=("--property=${setting}")
done < <(sed -n '/^\[Service\]/,/^\[/{/^[A-Za-z]/p}' "${unit_file}" | grep -Ev "${skipped_settings}")

optional_environment=()
if [[ -n "${SNAPFLOW_TEMPLATE_MAX_UNUSED_AGE:-}" ]]; then
	optional_environment+=("--setenv=SNAPFLOW_TEMPLATE_MAX_UNUSED_AGE=${SNAPFLOW_TEMPLATE_MAX_UNUSED_AGE}")
fi

trap 'sudo systemctl stop "${unit_name}"' INT TERM

sudo systemd-run --unit="${unit_name}" --description="Snapflow Service (development)" \
	--collect --wait --pipe --quiet \
	"${properties[@]}" \
	--setenv=SSL_CERT_FILE="${edge_ca}" \
	--setenv=SNAPFLOW_DEVELOPMENT_MACHINE_ENROLLMENT_SECRET="${SNAPFLOW_DEVELOPMENT_MACHINE_ENROLLMENT_SECRET}" \
	--setenv=SNAPFLOW_OFFERED_VCPUS="${offered_vcpus}" \
	--setenv=SNAPFLOW_OFFERED_MEMORY_GIB="${offered_memory_gib}" \
	--setenv=SNAPFLOW_OFFERED_DISK_GIB="${offered_disk_gib}" \
	--setenv=SNAPFLOW_LOG_LEVEL="${SNAPFLOW_LOG_LEVEL:-info}" \
	"${optional_environment[@]}" \
	"${daemon}" --profile development &
wait "$!"
