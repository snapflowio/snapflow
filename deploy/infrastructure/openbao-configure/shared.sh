# shellcheck shell=sh
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

readonly pki_mount="pki"
readonly pki_role="snapflow-tunnel-machine"
readonly origin_pki_role="snapflow-tunnel-origin"
readonly tunnel_trust_domain="tunnel.snapflow.internal"
readonly pki_max_lease_ttl="87600h"
readonly pki_root_key_type="ed25519"
readonly pki_certificate_ttl="10m"
readonly origin_pull_pki_mount="pki-origin-pull"
readonly origin_pull_role="cloudflare-origin-pull"
readonly origin_pull_common_name="cloudflare-origin-pull"
readonly origin_pull_root_key_type="ec"
readonly origin_pull_root_key_bits=384
readonly origin_pull_key_type="rsa"
readonly origin_pull_key_bits=2048
readonly origin_pull_certificate_ttl="8760h"
readonly kv_mount="secret"
readonly transit_mount="transit"
readonly registry_token_key="snapflow-registry"
readonly registry_token_key_type="ed25519"
readonly voucher_signer_key="snapflow-voucher-signer"
readonly voucher_signer_key_type="aes256-gcm96"
readonly keyring_prefix="snapflow/api"
readonly keyring_names="encryption-keyring hmac-keyring"
readonly keyring_field="keyring"
readonly keyring_schema="snapflow.keyring.v1"
readonly keyring_key_bytes=32
readonly api_policy="snapflow-api"
readonly origin_policy="snapflow-origin"

mount_exists() {
	bao secrets list -format=json | grep -q "\"$1/\""
}

secret_exists() {
	bao kv get -mount="${kv_mount}" "$1" >/dev/null 2>&1
}

write_policy() {
	bao policy write "$1" - >/dev/null
}

write_tunnel_role() {
	bao write "${pki_mount}/roles/$1" \
		allowed_uri_sans="spiffe://${tunnel_trust_domain}/$2/*" \
		enforce_hostnames=false \
		key_type="any" \
		key_usage="DigitalSignature" \
		client_flag=true \
		server_flag=false \
		require_cn=false \
		ttl="${pki_certificate_ttl}" \
		max_ttl="${pki_certificate_ttl}" >/dev/null
}

configure_tunnel_pki() {
	if ! mount_exists "${pki_mount}"; then
		bao secrets enable -path="${pki_mount}" pki
	fi
	bao secrets tune -max-lease-ttl="${pki_max_lease_ttl}" "${pki_mount}"
	if ! bao read "${pki_mount}/cert/ca" >/dev/null 2>&1; then
		bao write "${pki_mount}/root/generate/internal" \
			common_name="$1" \
			issuer_name="$2" \
			key_type="${pki_root_key_type}" \
			ttl="${pki_max_lease_ttl}" >/dev/null
	fi
	write_tunnel_role "${pki_role}" machine
	write_tunnel_role "${origin_pki_role}" origin
}

configure_origin_pull_pki() {
	if ! mount_exists "${origin_pull_pki_mount}"; then
		bao secrets enable -path="${origin_pull_pki_mount}" pki
	fi
	bao secrets tune -max-lease-ttl="${pki_max_lease_ttl}" "${origin_pull_pki_mount}"
	if ! bao read "${origin_pull_pki_mount}/cert/ca" >/dev/null 2>&1; then
		bao write "${origin_pull_pki_mount}/root/generate/internal" \
			common_name="$1" \
			issuer_name="$2" \
			key_type="${origin_pull_root_key_type}" \
			key_bits="${origin_pull_root_key_bits}" \
			ttl="${pki_max_lease_ttl}" >/dev/null
	fi
	bao write "${origin_pull_pki_mount}/roles/${origin_pull_role}" \
		allowed_domains="${origin_pull_common_name}" \
		allow_bare_domains=true \
		allow_subdomains=false \
		allow_localhost=false \
		allow_ip_sans=false \
		enforce_hostnames=false \
		key_type="${origin_pull_key_type}" \
		key_bits="${origin_pull_key_bits}" \
		key_usage="DigitalSignature,KeyEncipherment" \
		client_flag=true \
		server_flag=false \
		no_store=true \
		ttl="${origin_pull_certificate_ttl}" \
		max_ttl="${origin_pull_certificate_ttl}" >/dev/null
}

configure_secret_engines() {
	if ! mount_exists "${kv_mount}"; then
		bao secrets enable -path="${kv_mount}" -version=2 kv
	fi
	if ! mount_exists "${transit_mount}"; then
		bao secrets enable -path="${transit_mount}" transit
	fi
	if ! bao read "${transit_mount}/keys/${registry_token_key}" >/dev/null 2>&1; then
		bao write -f "${transit_mount}/keys/${registry_token_key}" type="${registry_token_key_type}" >/dev/null
	fi
	if ! bao read "${transit_mount}/keys/${voucher_signer_key}" >/dev/null 2>&1; then
		bao write -f "${transit_mount}/keys/${voucher_signer_key}" type="${voucher_signer_key_type}" >/dev/null
	fi
}

write_service_policies() {
	write_policy "${api_policy}" <<POLICY
path "${pki_mount}/sign/${pki_role}" {
  capabilities = ["update"]
}
path "${origin_pull_pki_mount}/issue/${origin_pull_role}" {
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
path "${transit_mount}/encrypt/${voucher_signer_key}" {
  capabilities = ["update"]
}
path "${transit_mount}/decrypt/${voucher_signer_key}" {
  capabilities = ["update"]
}
POLICY
	write_policy "${origin_policy}" <<POLICY
path "${pki_mount}/sign/${origin_pki_role}" {
  capabilities = ["update"]
}
POLICY
}

ensure_keyrings() {
	for name in ${keyring_names}; do
		path="${keyring_prefix}/${name}"
		if ! secret_exists "${path}"; then
			key="$(head -c "${keyring_key_bytes}" /dev/urandom | base64)"
			printf '{"schema":"%s","currentKeyId":"%s","keys":{"%s":"%s"}}' \
				"${keyring_schema}" "$1" "$1" "${key}" |
				bao kv put -mount="${kv_mount}" -cas=0 "${path}" "${keyring_field}=-" >/dev/null
		fi
	done
}
