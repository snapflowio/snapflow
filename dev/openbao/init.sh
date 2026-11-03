#!/bin/sh

set -eu

readonly init_file="/openbao/init/init.json"
readonly pki_mount="pki"
readonly pki_role="snapflow-tunnel-machine"
readonly api_policy="snapflow-api"
readonly kv_mount="secret"
readonly transit_mount="transit"
readonly registry_token_key="snapflow-registry"
readonly registry_token_key_type="ed25519"
readonly keyring_prefix="snapflow/api"
readonly keyring_names="encryption-keyring hmac-keyring"
readonly keyring_field="keyring"
readonly keyring_schema="snapflow.keyring.v1"
readonly keyring_key_id="development-1"
readonly keyring_key_bytes=32
readonly token_path="/run/snapflow-openbao/api-token"
readonly ca_path="/export/tunnel-client-ca.pem"
readonly unseal_shares=1

json_field() {
	sed -n "s/.*\"$1\": *\"\([^\"]*\)\".*/\1/p" "${init_file}" | head -n 1
}

umask 077
for _ in $(seq 1 30); do
	if bao status >/dev/null 2>&1 || [ $? -eq 2 ]; then break; fi
	sleep 1
done
if bao status -format=json | grep -q '"initialized": false'; then
	bao operator init -key-shares="${unseal_shares}" -key-threshold="${unseal_shares}" \
		-format=json >"${init_file}"
fi
if bao status -format=json | grep -q '"sealed": true'; then
	bao operator unseal "$(sed -n '/"unseal_keys_b64"/{n;p;}' "${init_file}" | tr -d ' ",')" >/dev/null
fi
BAO_TOKEN="$(json_field root_token)"
export BAO_TOKEN

if ! bao secrets list -format=json | grep -q '"pki/"'; then
	bao secrets enable -path="${pki_mount}" pki
fi

bao secrets tune -max-lease-ttl=87600h "${pki_mount}"
if ! bao read "${pki_mount}/cert/ca" >/dev/null 2>&1; then
	bao write "${pki_mount}/root/generate/internal" \
		common_name="Snapflow Local Tunnel Root CA" \
		issuer_name="snapflow-local-tunnel-root" \
		key_type="ed25519" \
		ttl="87600h"
fi

bao write "${pki_mount}/roles/${pki_role}" \
	allowed_uri_sans="spiffe://tunnel.snapflow.internal/*" \
	enforce_hostnames=false \
	key_type="any" \
	key_usage="DigitalSignature" \
	client_flag=true \
	server_flag=false \
	require_cn=false \
	ttl="10m" \
	max_ttl="10m"

if ! bao secrets list -format=json | grep -q "\"${kv_mount}/\""; then
	bao secrets enable -path="${kv_mount}" -version=2 kv
fi

if ! bao secrets list -format=json | grep -q "\"${transit_mount}/\""; then
	bao secrets enable -path="${transit_mount}" transit
fi
if ! bao read "${transit_mount}/keys/${registry_token_key}" >/dev/null 2>&1; then
	bao write -f "${transit_mount}/keys/${registry_token_key}" type="${registry_token_key_type}" >/dev/null
fi

for name in ${keyring_names}; do
	path="${keyring_prefix}/${name}"
	if ! bao kv get -mount="${kv_mount}" "${path}" >/dev/null 2>&1; then
		key="$(head -c "${keyring_key_bytes}" /dev/urandom | base64)"
		printf '{"schema":"%s","currentKeyId":"%s","keys":{"%s":"%s"}}' \
			"${keyring_schema}" "${keyring_key_id}" "${keyring_key_id}" "${key}" |
			bao kv put -mount="${kv_mount}" -cas=0 "${path}" "${keyring_field}=-" >/dev/null
	fi
done

bao policy write "${api_policy}" - <<POLICY
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

mkdir -p "$(dirname "${token_path}")" "$(dirname "${ca_path}")"
bao token create \
	-orphan \
	-period=24h \
	-policy="${api_policy}" \
	-field=token >"${token_path}"
chown "$(id -u openbao):$(id -g openbao)" "${token_path}"
chmod 0600 "${token_path}"
bao read -field=certificate "${pki_mount}/cert/ca" >"${ca_path}"
chmod 0644 "${ca_path}"
