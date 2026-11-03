#!/bin/sh
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Generates the local Edge TLS identities. The server chain is a root that
# browsers trust, a name-constrained intermediate, and the Edge leaf. Both CA
# keys are discarded after signing, so a leaked .tmp directory cannot mint
# certificates for anything outside localhost.

set -eu

workspace_root="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
readonly workspace_root
readonly output_dir="${workspace_root}/.tmp/edge/tls"
readonly validity_days="825"
readonly root_common_name_prefix="Snapflow Local Development Root"
readonly local_name_constraints='nameConstraints=critical,permitted;DNS:localhost,permitted;IP:127.0.0.0/255.0.0.0,permitted;IP:::1/ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'

readonly server_ca_certificate="${output_dir}/edge-server-ca.pem"
readonly server_key="${output_dir}/edge-server-key.pem"
readonly server_certificate="${output_dir}/edge-server.pem"
readonly origin_ca_key="${output_dir}/origin-client-ca-key.pem"
readonly origin_ca_certificate="${output_dir}/origin-client-ca.pem"
readonly origin_key="${output_dir}/origin-client-key.pem"
readonly origin_csr="${output_dir}/origin-client.csr"
readonly origin_certificate="${output_dir}/origin-client.pem"

mkdir -p "${output_dir}"
temporary_dir="$(mktemp -d "${output_dir}/generation.XXXXXX")"
readonly temporary_dir
trap 'rm -rf "${temporary_dir}"' EXIT HUP INT TERM

readonly root_key="${temporary_dir}/root-key.pem"
readonly intermediate_key="${temporary_dir}/intermediate-key.pem"
readonly intermediate_csr="${temporary_dir}/intermediate.csr"
readonly intermediate_certificate="${temporary_dir}/intermediate.pem"
readonly server_csr="${temporary_dir}/edge-server.csr"
readonly server_leaf="${temporary_dir}/edge-server-leaf.pem"
readonly intermediate_extensions="${temporary_dir}/intermediate-extensions.cnf"
readonly server_extensions="${temporary_dir}/server-extensions.cnf"
readonly client_extensions="${temporary_dir}/client-extensions.cnf"
printf '%s\n' \
	'basicConstraints=critical,CA:TRUE,pathlen:0' \
	'keyUsage=critical,keyCertSign,cRLSign' \
	"${local_name_constraints}" \
	>"${intermediate_extensions}"
printf '%s\n' \
	'basicConstraints=critical,CA:FALSE' \
	'keyUsage=critical,digitalSignature' \
	'extendedKeyUsage=serverAuth' \
	'subjectAltName=DNS:localhost,DNS:snapflow.localhost,DNS:*.snapflow.localhost,IP:127.0.0.1,IP:::1' \
	>"${server_extensions}"
printf '%s\n' \
	'basicConstraints=critical,CA:FALSE' \
	'keyUsage=critical,digitalSignature' \
	'extendedKeyUsage=clientAuth' \
	>"${client_extensions}"

openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 \
	-out "${root_key}"
openssl req -x509 -new \
	-key "${root_key}" \
	-out "${server_ca_certificate}" \
	-days "${validity_days}" \
	-subj "/CN=${root_common_name_prefix} $(hostname) $(date -u +%Y%m%dT%H%M%SZ)" \
	-addext 'basicConstraints=critical,CA:TRUE,pathlen:1' \
	-addext 'keyUsage=critical,keyCertSign,cRLSign' \
	-addext "${local_name_constraints}"
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 \
	-out "${intermediate_key}"
openssl req -new \
	-key "${intermediate_key}" \
	-out "${intermediate_csr}" \
	-subj '/CN=Snapflow Local Edge Intermediate'
openssl x509 -req \
	-in "${intermediate_csr}" \
	-CA "${server_ca_certificate}" \
	-CAkey "${root_key}" \
	-set_serial "0x$(openssl rand -hex 16)" \
	-out "${intermediate_certificate}" \
	-days "${validity_days}" \
	-extfile "${intermediate_extensions}"
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 \
	-out "${server_key}"
openssl req -new \
	-key "${server_key}" \
	-out "${server_csr}" \
	-subj '/CN=*.snapflow.localhost'
openssl x509 -req \
	-in "${server_csr}" \
	-CA "${intermediate_certificate}" \
	-CAkey "${intermediate_key}" \
	-set_serial "0x$(openssl rand -hex 16)" \
	-out "${server_leaf}" \
	-days "${validity_days}" \
	-extfile "${server_extensions}"
cat "${server_leaf}" "${intermediate_certificate}" >"${server_certificate}"

openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 \
	-out "${origin_ca_key}"
openssl req -x509 -new \
	-key "${origin_ca_key}" \
	-out "${origin_ca_certificate}" \
	-days "${validity_days}" \
	-subj '/CN=Snapflow Local Origin Client CA' \
	-addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
	-addext 'keyUsage=critical,keyCertSign,cRLSign'
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 \
	-out "${origin_key}"
openssl req -new \
	-key "${origin_key}" \
	-out "${origin_csr}" \
	-subj '/CN=Snapflow Local Origin Client'
openssl x509 -req \
	-in "${origin_csr}" \
	-CA "${origin_ca_certificate}" \
	-CAkey "${origin_ca_key}" \
	-set_serial "0x$(openssl rand -hex 16)" \
	-out "${origin_certificate}" \
	-days "${validity_days}" \
	-extfile "${client_extensions}"

rm -f "${origin_csr}" "${output_dir}/edge-server-ca-key.pem"
chmod 600 "${server_key}" "${origin_ca_key}" "${origin_key}"
chmod 644 "${server_ca_certificate}" "${server_certificate}" \
	"${origin_ca_certificate}" "${origin_certificate}"

openssl verify -CAfile "${server_ca_certificate}" \
	-untrusted "${server_certificate}" "${server_certificate}"
openssl verify -purpose sslclient \
	-CAfile "${origin_ca_certificate}" "${origin_certificate}"
printf '%s\n' \
	'Generated a new local Edge root. Trust it in your browser by running this from the repository root on the host (outside the devcontainer):' \
	'  bash scripts/trust-local-edge-ca.sh'
