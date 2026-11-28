#!/bin/sh

set -eu

# shellcheck source=deploy/infrastructure/openbao-configure/shared.sh
. "$(dirname "$0")/shared.sh"

readonly init_file="/openbao/init/init.json"
readonly tunnel_root_common_name="Snapflow Local Tunnel Root CA"
readonly tunnel_root_issuer="snapflow-local-tunnel-root"
readonly origin_pull_root_common_name="Snapflow Local Cloudflare Origin Pull Root CA"
readonly origin_pull_root_issuer="snapflow-local-origin-pull-root"
readonly keyring_key_id="development-1"
readonly token_path="/run/snapflow-openbao/api-token"
readonly token_period="24h"
readonly ca_path="/export/tunnel-client-ca.pem"
readonly unseal_shares=1
readonly startup_attempts=30
readonly edge_pki_mount="pki-local-edge"
readonly edge_policy="snapflow-local-edge"
readonly edge_key_type="ec"
readonly edge_key_bits=256
readonly edge_root_ttl="87600h"
readonly edge_leaf_ttl="2160h"
readonly edge_server_root="local-edge-root"
readonly edge_server_root_common_name="Snapflow Local Development Root"
readonly edge_server_permitted_domains="localhost"
readonly edge_server_role="local-edge-server"
readonly edge_server_domains="snapflow.localhost"
readonly edge_server_ip_ranges="127.0.0.0/8,::1/128"
readonly edge_origin_root="local-origin-client-root"
readonly edge_origin_root_common_name="Snapflow Local Origin Client CA"
readonly edge_origin_role="local-origin-client"
readonly edge_origin_common_name="Snapflow Local Origin Client"

json_field() {
	sed -n "s/.*\"$1\": *\"\([^\"]*\)\".*/\1/p" "${init_file}" | head -n 1
}

generate_edge_root() {
	issuer="$1"
	common_name="$2"
	shift 2
	if ! bao read "${edge_pki_mount}/issuer/${issuer}" >/dev/null 2>&1; then
		bao write "${edge_pki_mount}/root/generate/internal" \
			common_name="${common_name}" \
			issuer_name="${issuer}" \
			key_type="${edge_key_type}" \
			key_bits="${edge_key_bits}" \
			ttl="${edge_root_ttl}" "$@" >/dev/null
	fi
}

umask 077
for _ in $(seq 1 "${startup_attempts}"); do
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

configure_tunnel_pki "${tunnel_root_common_name}" "${tunnel_root_issuer}"
configure_origin_pull_pki "${origin_pull_root_common_name}" "${origin_pull_root_issuer}"
configure_secret_engines
write_service_policies
ensure_keyrings "${keyring_key_id}"

if ! mount_exists "${edge_pki_mount}"; then
	bao secrets enable -path="${edge_pki_mount}" pki
fi
bao secrets tune -max-lease-ttl="${edge_root_ttl}" "${edge_pki_mount}"
generate_edge_root "${edge_server_root}" "${edge_server_root_common_name}" \
	permitted_dns_domains="${edge_server_permitted_domains}"
generate_edge_root "${edge_origin_root}" "${edge_origin_root_common_name}"

bao write "${edge_pki_mount}/roles/${edge_server_role}" \
	issuer_ref="${edge_server_root}" \
	allowed_domains="${edge_server_domains}" \
	allow_bare_domains=true \
	allow_subdomains=true \
	allow_wildcard_certificates=true \
	allow_localhost=true \
	allow_ip_sans=true \
	allowed_ip_sans_cidr="${edge_server_ip_ranges}" \
	key_type="${edge_key_type}" \
	key_bits="${edge_key_bits}" \
	key_usage="DigitalSignature" \
	server_flag=true \
	client_flag=false \
	no_store=true \
	ttl="${edge_leaf_ttl}" \
	max_ttl="${edge_leaf_ttl}" >/dev/null

bao write "${edge_pki_mount}/roles/${edge_origin_role}" \
	issuer_ref="${edge_origin_root}" \
	allowed_domains="${edge_origin_common_name}" \
	allow_bare_domains=true \
	enforce_hostnames=false \
	key_type="${edge_key_type}" \
	key_bits="${edge_key_bits}" \
	key_usage="DigitalSignature" \
	server_flag=false \
	client_flag=true \
	no_store=true \
	ttl="${edge_leaf_ttl}" \
	max_ttl="${edge_leaf_ttl}" >/dev/null

write_policy "${edge_policy}" <<POLICY
path "${edge_pki_mount}/issue/${edge_server_role}" {
  capabilities = ["update"]
}
path "${edge_pki_mount}/issue/${edge_origin_role}" {
  capabilities = ["update"]
}
POLICY

mkdir -p "$(dirname "${token_path}")" "$(dirname "${ca_path}")"
bao token create \
	-orphan \
	-period="${token_period}" \
	-policy="${api_policy}" \
	-policy="${edge_policy}" \
	-policy="${origin_policy}" \
	-field=token >"${token_path}"
chown "$(id -u openbao):$(id -g openbao)" "${token_path}"
chmod 0600 "${token_path}"
bao read -field=certificate "${pki_mount}/cert/ca" >"${ca_path}"
chmod 0644 "${ca_path}"
