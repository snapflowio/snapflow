#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Trusts the local Edge root in the host's browser trust stores so the
# dashboard can reach https://*.snapflow.localhost:8444. Run it on the host:
# from WSL it installs into the Windows user store, otherwise into the macOS
# login keychain or the Linux system and NSS stores. A previously trusted
# Snapflow development root is replaced.

set -euo pipefail

workspace_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly workspace_root
readonly root_certificate="${workspace_root}/.tmp/edge/tls/edge-server-ca.pem"
readonly retired_root_key="${workspace_root}/.tmp/edge/tls/edge-server-ca-key.pem"
readonly root_common_name_prefix="Snapflow Local Development Root"
readonly trust_file_name="snapflow-local-development-root.crt"
readonly nss_database="sql:${HOME}/.pki/nssdb"

fail() {
	printf 'error: %s\n' "$1" >&2
	exit 1
}

assert_constrained_root() {
	[[ -s "$root_certificate" ]] ||
		fail "no local Edge root at ${root_certificate}; run 'moon run edge:prepare-development-tls' first"
	[[ ! -e "$retired_root_key" ]] ||
		fail "the local Edge root still has a signing key; run 'moon run edge:prepare-development-tls' to regenerate it"
	openssl x509 -in "$root_certificate" -noout -subject | grep -q "$root_common_name_prefix" ||
		fail "${root_certificate} is not a Snapflow development root"
	openssl x509 -in "$root_certificate" -noout -ext nameConstraints | grep -q 'Permitted' ||
		fail "${root_certificate} has no name constraints; refusing to trust it"
}

trust_windows() {
	local encoded
	encoded="$(openssl x509 -in "$root_certificate" -outform der | base64 -w 0)"
	powershell.exe -NoProfile -NonInteractive -Command "
		\$ErrorActionPreference = 'Stop'
		\$certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new([Convert]::FromBase64String('${encoded}'))
		\$store = [System.Security.Cryptography.X509Certificates.X509Store]::new('Root', 'CurrentUser')
		\$store.Open('ReadWrite')
		try {
			\$store.Certificates |
				Where-Object { \$_.Subject -like 'CN=${root_common_name_prefix}*' -and \$_.Thumbprint -ne \$certificate.Thumbprint } |
				ForEach-Object { \$store.Remove(\$_) }
			\$store.Add(\$certificate)
		} finally {
			\$store.Close()
		}
		Write-Output ('Trusted ' + \$certificate.Subject + ' in the Windows user root store')
	" | tr -d '\r'
}

trust_macos() {
	local keychain="${HOME}/Library/Keychains/login.keychain-db"
	local current
	current="$(openssl x509 -in "$root_certificate" -noout -fingerprint -sha1 | cut -d= -f2 | tr -d :)"
	security find-certificate -a -Z -c "$root_common_name_prefix" "$keychain" |
		awk '/^SHA-1 hash:/ { print $3 }' |
		while read -r hash; do
			if [[ "$hash" != "$current" ]]; then
				security delete-certificate -Z "$hash" "$keychain"
			fi
		done
	security add-trusted-cert -r trustRoot -p ssl -k "$keychain" "$root_certificate"
	printf 'Trusted the Snapflow development root in the macOS login keychain\n'
}

trust_linux() {
	if command -v trust >/dev/null && [[ -d /etc/ca-certificates/trust-source/anchors ]]; then
		sudo install -m 644 "$root_certificate" "/etc/ca-certificates/trust-source/anchors/${trust_file_name}"
		sudo trust extract-compat
	elif command -v update-ca-certificates >/dev/null; then
		sudo install -m 644 "$root_certificate" "/usr/local/share/ca-certificates/${trust_file_name}"
		sudo update-ca-certificates
	else
		fail 'no supported system trust store tool (p11-kit trust or update-ca-certificates)'
	fi
	if command -v certutil >/dev/null && [[ -d "${HOME}/.pki/nssdb" ]]; then
		if certutil -d "$nss_database" -L -n "$root_common_name_prefix" >/dev/null 2>&1; then
			certutil -d "$nss_database" -D -n "$root_common_name_prefix"
		fi
		certutil -d "$nss_database" -A -t 'C,,' -n "$root_common_name_prefix" -i "$root_certificate"
	fi
	printf 'Trusted the Snapflow development root in the Linux system and NSS stores\n'
}

if [[ -e /.dockerenv || -n "${REMOTE_CONTAINERS:-}" ]]; then
	fail 'run this on the host (for example from WSL), not inside the devcontainer'
fi
assert_constrained_root

if command -v powershell.exe >/dev/null; then
	trust_windows
elif [[ "$(uname -s)" == 'Darwin' ]]; then
	trust_macos
else
	trust_linux
fi
printf 'Restart the browser so it reloads its trust store.\n'
