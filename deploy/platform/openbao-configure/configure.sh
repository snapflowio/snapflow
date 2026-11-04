#!/bin/sh
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -eu

readonly login_role="snapflow-configure"
readonly token_file="/var/run/secrets/openbao/token"
readonly token_audience="openbao"
readonly pki_mount="pki"
readonly pki_role="snapflow-tunnel-machine"
readonly pki_max_lease_ttl="87600h"
readonly pki_certificate_ttl="10m"
readonly kv_mount="secret"
readonly transit_mount="transit"
readonly registry_token_key="snapflow-registry"
readonly registry_token_key_type="ed25519"
readonly keyring_prefix="snapflow/api"
readonly keyring_names="encryption-keyring hmac-keyring"
readonly keyring_field="keyring"
readonly keyring_schema="snapflow.keyring.v1"
readonly keyring_key_id="production-1"
readonly keyring_key_bytes=32
readonly generated_secret_length=40
readonly service_token_ttl="1h"
# The secrets the operator supplies in the OpenBao UI, under snapflow/.
readonly operator_secret_paths="api alerts backups cloudflare-dns edges/*"

BAO_TOKEN="$(bao write -field=token "auth/kubernetes/login" role="${login_role}" jwt="$(cat "${token_file}")")"
export BAO_TOKEN

mount_exists() {
	bao secrets list -format=json | grep -q "\"$1/\""
}

secret_exists() {
	bao kv get -mount="${kv_mount}" "$1" >/dev/null 2>&1
}

random_secret() {
	head -c 256 /dev/urandom | tr -dc 'A-Za-z0-9' | head -c "${generated_secret_length}"
}

write_policy() {
	bao policy write "$1" - >/dev/null
}

write_role() {
	bao write "auth/kubernetes/role/$1" \
		bound_service_account_names="$2" \
		bound_service_account_namespaces="$3" \
		audience="${token_audience}" \
		token_policies="$1" \
		token_ttl="${service_token_ttl}" >/dev/null
}

if ! mount_exists "${pki_mount}"; then
	bao secrets enable -path="${pki_mount}" pki
fi
bao secrets tune -max-lease-ttl="${pki_max_lease_ttl}" "${pki_mount}"
if ! bao read "${pki_mount}/cert/ca" >/dev/null 2>&1; then
	bao write "${pki_mount}/root/generate/internal" \
		common_name="Snapflow Tunnel Root CA" \
		issuer_name="snapflow-tunnel-root" \
		key_type="ed25519" \
		ttl="${pki_max_lease_ttl}" >/dev/null
fi
bao write "${pki_mount}/roles/${pki_role}" \
	allowed_uri_sans="spiffe://tunnel.snapflow.internal/*" \
	enforce_hostnames=false \
	key_type="any" \
	key_usage="DigitalSignature" \
	client_flag=true \
	server_flag=false \
	require_cn=false \
	ttl="${pki_certificate_ttl}" \
	max_ttl="${pki_certificate_ttl}" >/dev/null

if ! mount_exists "${kv_mount}"; then
	bao secrets enable -path="${kv_mount}" -version=2 kv
fi

if ! mount_exists "${transit_mount}"; then
	bao secrets enable -path="${transit_mount}" transit
fi
if ! bao read "${transit_mount}/keys/${registry_token_key}" >/dev/null 2>&1; then
	bao write -f "${transit_mount}/keys/${registry_token_key}" type="${registry_token_key_type}" >/dev/null
fi

write_policy snapflow-api <<POLICY
path "${pki_mount}/sign/${pki_role}" {
  capabilities = ["update"]
}
path "${kv_mount}/data/${keyring_prefix}/*" {
  capabilities = ["read"]
}
path "${transit_mount}/sign/${registry_token_key}" {
  capabilities = ["update"]
}
path "${transit_mount}/keys/${registry_token_key}" {
  capabilities = ["read"]
}
POLICY

write_policy external-secrets <<POLICY
path "${kv_mount}/data/snapflow/*" {
  capabilities = ["read"]
}
POLICY

# The operator (moon run deploy:openbao, docs/deployment.md "Secrets") manages
# only the secrets it supplies: it can browse the snapflow folder and create,
# edit, roll back and delete these paths, but cannot read the keyrings and
# platform credentials this job generates or change OpenBao itself.
{
	printf 'path "%s/metadata/" {\n  capabilities = ["list"]\n}\n' "${kv_mount}"
	printf 'path "%s/metadata/snapflow/" {\n  capabilities = ["list"]\n}\n' "${kv_mount}"
	printf 'path "%s/metadata/snapflow/edges/" {\n  capabilities = ["list"]\n}\n' "${kv_mount}"
	# The paths are policy globs, not files, so they must not expand here.
	set -f
	for path in ${operator_secret_paths}; do
		printf 'path "%s/data/snapflow/%s" {\n  capabilities = ["create", "read", "update", "delete"]\n}\n' "${kv_mount}" "${path}"
		printf 'path "%s/metadata/snapflow/%s" {\n  capabilities = ["read", "list", "delete"]\n}\n' "${kv_mount}" "${path}"
		printf 'path "%s/undelete/snapflow/%s" {\n  capabilities = ["update"]\n}\n' "${kv_mount}" "${path}"
	done
	set +f
	# The read-only database login (docs/deployment.md, "Querying the
	# database") is generated below; the operator may read it, nothing more.
	printf 'path "%s/metadata/snapflow/platform/" {\n  capabilities = ["list"]\n}\n' "${kv_mount}"
	printf 'path "%s/data/snapflow/platform/postgres-readonly" {\n  capabilities = ["read"]\n}\n' "${kv_mount}"
	printf 'path "%s/metadata/snapflow/platform/postgres-readonly" {\n  capabilities = ["read"]\n}\n' "${kv_mount}"
} | write_policy snapflow-operator

# The backup CronJob (deploy/platform/backups) may take a raft snapshot and
# nothing else.
write_policy snapflow-openbao-backup <<POLICY
path "sys/storage/raft/snapshot" {
  capabilities = ["read"]
}
POLICY

write_role snapflow-api snapflow-api snapflow
write_role external-secrets external-secrets external-secrets
write_role snapflow-openbao-backup openbao-backup openbao
write_role snapflow-operator snapflow-openbao-operator openbao

for name in ${keyring_names}; do
	path="${keyring_prefix}/${name}"
	if ! secret_exists "${path}"; then
		key="$(head -c "${keyring_key_bytes}" /dev/urandom | base64)"
		printf '{"schema":"%s","currentKeyId":"%s","keys":{"%s":"%s"}}' \
			"${keyring_schema}" "${keyring_key_id}" "${keyring_key_id}" "${key}" |
			bao kv put -mount="${kv_mount}" -cas=0 "${path}" "${keyring_field}=-" >/dev/null
	fi
done

if ! secret_exists snapflow/platform/redis; then
	bao kv put -mount="${kv_mount}" -cas=0 snapflow/platform/redis \
		password="$(random_secret)" >/dev/null
fi
if ! secret_exists snapflow/platform/rustfs; then
	bao kv put -mount="${kv_mount}" -cas=0 snapflow/platform/rustfs \
		access-key="$(random_secret)" secret-key="$(random_secret)" >/dev/null
fi
if ! secret_exists snapflow/platform/postgres-readonly; then
	bao kv put -mount="${kv_mount}" -cas=0 snapflow/platform/postgres-readonly \
		username=snapflow_readonly password="$(random_secret)" >/dev/null
fi
if ! secret_exists snapflow/platform/snapshot-manager; then
	bao kv put -mount="${kv_mount}" -cas=0 snapflow/platform/snapshot-manager \
		http-secret="$(random_secret)" >/dev/null
fi

bao read -field=certificate "${pki_mount}/cert/ca" |
	bao kv put -mount="${kv_mount}" snapflow/edge/tunnel-client-ca certificate=- >/dev/null

echo "OpenBao configuration is reconciled"
