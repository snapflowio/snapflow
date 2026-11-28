#!/bin/sh
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -eu

# shellcheck source=deploy/infrastructure/openbao-configure/shared.sh
. "$(dirname "$0")/shared.sh"

readonly login_role="snapflow-configure"
readonly token_file="/var/run/secrets/openbao/token"
readonly token_audience="openbao"
readonly tunnel_root_common_name="Snapflow Tunnel Root CA"
readonly tunnel_root_issuer="snapflow-tunnel-root"
readonly origin_pull_root_common_name="Snapflow Cloudflare Origin Pull Root CA"
readonly origin_pull_root_issuer="snapflow-origin-pull-root"
readonly origin_pull_ca_secret="snapflow/cloudflare/origin-pull-ca"
readonly keyring_key_id="production-1"
readonly generated_secret_length=40
readonly service_token_ttl="1h"
readonly operator_secret_paths="api worker alerts backups storage cloudflare-dns edges/*"

BAO_TOKEN="$(bao write -field=token "auth/kubernetes/login" role="${login_role}" jwt="$(cat "${token_file}")")"
export BAO_TOKEN

random_secret() {
	head -c 256 /dev/urandom | tr -dc 'A-Za-z0-9' | head -c "${generated_secret_length}"
}

write_role() {
	bao write "auth/kubernetes/role/$1" \
		bound_service_account_names="$2" \
		bound_service_account_namespaces="$3" \
		audience="${token_audience}" \
		token_policies="$1" \
		token_ttl="${service_token_ttl}" >/dev/null
}

configure_tunnel_pki "${tunnel_root_common_name}" "${tunnel_root_issuer}"
configure_origin_pull_pki "${origin_pull_root_common_name}" "${origin_pull_root_issuer}"
configure_secret_engines
write_service_policies

write_policy external-secrets <<POLICY
path "${kv_mount}/data/snapflow/*" {
  capabilities = ["read"]
}
POLICY

{
	printf 'path "%s/metadata/" {\n  capabilities = ["list"]\n}\n' "${kv_mount}"
	printf 'path "%s/metadata/snapflow/" {\n  capabilities = ["list"]\n}\n' "${kv_mount}"
	printf 'path "%s/metadata/snapflow/edges/" {\n  capabilities = ["list"]\n}\n' "${kv_mount}"
	set -f
	for path in ${operator_secret_paths}; do
		printf 'path "%s/data/snapflow/%s" {\n  capabilities = ["create", "read", "update", "delete"]\n}\n' "${kv_mount}" "${path}"
		printf 'path "%s/metadata/snapflow/%s" {\n  capabilities = ["read", "list", "delete"]\n}\n' "${kv_mount}" "${path}"
		printf 'path "%s/undelete/snapflow/%s" {\n  capabilities = ["update"]\n}\n' "${kv_mount}" "${path}"
	done
	set +f
	printf 'path "%s/metadata/snapflow/platform/" {\n  capabilities = ["list"]\n}\n' "${kv_mount}"
	printf 'path "%s/data/snapflow/platform/postgres-readonly" {\n  capabilities = ["read"]\n}\n' "${kv_mount}"
	printf 'path "%s/metadata/snapflow/platform/postgres-readonly" {\n  capabilities = ["read"]\n}\n' "${kv_mount}"
	printf 'path "%s/data/snapflow/platform/grafana" {\n  capabilities = ["read"]\n}\n' "${kv_mount}"
	printf 'path "%s/metadata/snapflow/platform/grafana" {\n  capabilities = ["read"]\n}\n' "${kv_mount}"
} | write_policy snapflow-operator

write_policy snapflow-openbao-backup <<POLICY
path "sys/storage/raft/snapshot" {
  capabilities = ["read"]
}
POLICY

write_role "${api_policy}" snapflow-api snapflow
write_role external-secrets external-secrets external-secrets
write_role snapflow-openbao-backup openbao-backup openbao
write_role snapflow-operator snapflow-openbao-operator openbao
write_role "${origin_policy}" snapflow-origin snapflow

ensure_keyrings "${keyring_key_id}"

if ! secret_exists snapflow/platform/redis; then
	bao kv put -mount="${kv_mount}" -cas=0 snapflow/platform/redis \
		password="$(random_secret)" >/dev/null
fi
if ! secret_exists snapflow/platform/postgres-readonly; then
	bao kv put -mount="${kv_mount}" -cas=0 snapflow/platform/postgres-readonly \
		username=snapflow_readonly password="$(random_secret)" >/dev/null
fi
if ! secret_exists snapflow/platform/grafana; then
	bao kv put -mount="${kv_mount}" -cas=0 snapflow/platform/grafana \
		admin-user=admin admin-password="$(random_secret)" >/dev/null
fi
if ! secret_exists snapflow/platform/snapshot-manager; then
	bao kv put -mount="${kv_mount}" -cas=0 snapflow/platform/snapshot-manager \
		http-secret="$(random_secret)" >/dev/null
fi

bao read -field=certificate "${pki_mount}/cert/ca" |
	bao kv put -mount="${kv_mount}" snapflow/edge/tunnel-client-ca certificate=- >/dev/null
bao read -field=certificate "${origin_pull_pki_mount}/cert/ca" |
	bao kv put -mount="${kv_mount}" "${origin_pull_ca_secret}" certificate=- >/dev/null

echo "OpenBao configuration is reconciled"
