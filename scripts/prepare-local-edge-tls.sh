#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0


set -euo pipefail

workspace_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly workspace_root
readonly tls_dir="${workspace_root}/.tmp/edge/tls"
readonly setup_script="${workspace_root}/scripts/setup-local-edge-tls.sh"
readonly tunnel_ca="${workspace_root}/.tmp/openbao/tunnel-client-ca.pem"

local_tls_files=(
	"${tls_dir}/edge-server-ca.pem"
	"${tls_dir}/edge-server-key.pem"
	"${tls_dir}/edge-server.pem"
	"${tls_dir}/origin-client-ca.pem"
	"${tls_dir}/origin-client-key.pem"
	"${tls_dir}/origin-client.pem"
)
readonly local_tls_files

readonly retired_server_ca_key="${tls_dir}/edge-server-ca-key.pem"

edge_server_chain_verifies() {
	openssl verify \
		-CAfile "${tls_dir}/edge-server-ca.pem" \
		-untrusted "${tls_dir}/edge-server.pem" \
		-verify_hostname snapflow.localhost \
		"${tls_dir}/edge-server.pem" >/dev/null 2>&1
}

local_edge_tls_is_current() {
	local file
	for file in "${local_tls_files[@]}"; do
		[[ -s "$file" ]] || return 1
	done
	[[ ! -e "$retired_server_ca_key" ]] &&
		edge_server_chain_verifies &&
		openssl x509 -in "${tls_dir}/edge-server-ca.pem" -noout -ext nameConstraints 2>/dev/null |
			grep -q 'Permitted' &&
		openssl x509 -in "${tls_dir}/edge-server.pem" -noout -text |
			grep -q 'Public Key Algorithm: id-ecPublicKey' &&
		openssl x509 -checkend 60 -noout -in "${tls_dir}/edge-server.pem" >/dev/null
}

if ! local_edge_tls_is_current; then
	bash "$setup_script"
fi

for file in "${local_tls_files[@]}"; do
	if [[ ! -r "$file" || ! -s "$file" ]]; then
		printf 'error: required local Edge TLS file is unavailable: %s\n' "$file" >&2
		exit 1
	fi
done

if [[ ! -r "$tunnel_ca" || ! -s "$tunnel_ca" ]]; then
	printf '%s\n' \
		"error: the local OpenBao PKI trust root is unavailable: ${tunnel_ca}" \
		'error: rebuild the Snapflow devcontainer so openbao-init can provision the PKI and export its CA' >&2
	exit 1
fi

openssl x509 -checkend 60 -noout -in "${tls_dir}/edge-server.pem"
openssl x509 -checkend 60 -noout -in "${tls_dir}/origin-client.pem"
openssl x509 -checkend 60 -noout -in "$tunnel_ca"
openssl verify -CAfile "$tunnel_ca" "$tunnel_ca" >/dev/null
if ! local_edge_tls_is_current; then
	printf 'error: the local Edge TLS chain is invalid after regeneration: %s\n' "$tls_dir" >&2
	exit 1
fi
openssl verify \
	-purpose sslclient \
	-CAfile "${tls_dir}/origin-client-ca.pem" \
	"${tls_dir}/origin-client.pem" >/dev/null
