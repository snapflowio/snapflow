#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

: "${BAO_ADDR:?BAO_ADDR must point at the development OpenBao proxy}"

workspace_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly workspace_root
readonly tls_dir="${workspace_root}/.tmp/edge/tls"
readonly server_ca="${tls_dir}/edge-server-ca.pem"
readonly server_key="${tls_dir}/edge-server-key.pem"
readonly server_certificate="${tls_dir}/edge-server.pem"
readonly origin_ca="${tls_dir}/origin-client-ca.pem"
readonly origin_key="${tls_dir}/origin-client-key.pem"
readonly origin_certificate="${tls_dir}/origin-client.pem"

readonly pki_mount="pki-local-edge"
readonly server_issuer="local-edge-root"
readonly server_role="local-edge-server"
readonly server_common_name="*.snapflow.localhost"
readonly server_alt_names="snapflow.localhost,localhost"
readonly server_ip_sans="127.0.0.1,::1"
readonly server_verify_hostname="snapflow.localhost"
readonly origin_issuer="local-origin-client-root"
readonly origin_role="local-origin-client"
readonly origin_common_name="Snapflow Local Origin Client"
readonly private_key_format="pkcs8"
readonly renewal_window_seconds=$((7 * 24 * 60 * 60))

write_file() {
	local path="$1" mode="$2" temporary
	temporary="$(mktemp "${path}.XXXXXX")"
	cat >"$temporary"
	chmod "$mode" "$temporary"
	mv -f "$temporary" "$path"
}

fetch_root() {
	bao read -field=certificate "${pki_mount}/issuer/$1/json" | write_file "$2" 644
}

issue() {
	local role="$1" key="$2" certificate="$3" response
	shift 3
	response="$(bao write -format=json "${pki_mount}/issue/${role}" \
		private_key_format="$private_key_format" "$@")"
	jq -r .data.private_key <<<"$response" | write_file "$key" 600
	jq -r .data.certificate <<<"$response" | write_file "$certificate" 644
}

leaf_is_current() {
	local ca="$1" key="$2" certificate="$3"
	shift 3
	[[ -s "$key" ]] &&
		openssl x509 -checkend "$renewal_window_seconds" -noout -in "$certificate" >/dev/null 2>&1 &&
		openssl verify -CAfile "$ca" "$@" "$certificate" >/dev/null 2>&1
}

server_is_current() {
	leaf_is_current "$server_ca" "$server_key" "$server_certificate" \
		-purpose sslserver -verify_hostname "$server_verify_hostname"
}

origin_is_current() {
	leaf_is_current "$origin_ca" "$origin_key" "$origin_certificate" -purpose sslclient
}

mkdir -p "$tls_dir"
fetch_root "$server_issuer" "$server_ca"
fetch_root "$origin_issuer" "$origin_ca"

if ! server_is_current; then
	issue "$server_role" "$server_key" "$server_certificate" \
		common_name="$server_common_name" \
		alt_names="$server_alt_names" \
		ip_sans="$server_ip_sans"
	server_is_current || {
		printf 'error: the issued Edge server certificate does not verify: %s\n' "$server_certificate" >&2
		exit 1
	}
fi

if ! origin_is_current; then
	issue "$origin_role" "$origin_key" "$origin_certificate" \
		common_name="$origin_common_name"
	origin_is_current || {
		printf 'error: the issued origin client certificate does not verify: %s\n' "$origin_certificate" >&2
		exit 1
	}
fi
