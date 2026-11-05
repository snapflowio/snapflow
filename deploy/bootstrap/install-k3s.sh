#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Installs k3s on a node, as root on that node:
#   server-edge  the first server, which also runs the edge:
#                sudo PUBLIC_IP=<public ip> install-k3s.sh server-edge
#   server       a server without the edge
#   edge         an edge-only node that joins over WireGuard and is tainted for
#                the edge (K3S_URL, K3S_TOKEN and NODE_NAME required); then add
#                it to edges in deploy/apps/production/snapflow.yaml
# The API is advertised on the address of the default route (NODE_IP overrides).
# Upgrade by rerunning it with a newer k3s_version. Apply
# deploy/bootstrap/host-firewall.sh afterwards.

set -euo pipefail

readonly k3s_version="v1.36.5+k3s1"
readonly k3s_installer="https://get.k3s.io"
readonly config_directory="/etc/rancher/k3s"
readonly config_file="${config_directory}/config.yaml"
readonly edge_sysctl_file="/etc/sysctl.d/90-snapflow-edge.conf"
readonly edge_state_directory="/var/lib/snapflow/edge"
readonly edge_user_id=65532
readonly udp_buffer_bytes=7340032
readonly etcd_snapshot_schedule="0 */6 * * *"
readonly etcd_snapshot_retention=28
# Flux creates this Secret (deploy/platform/backups/k3s.yaml); k3s reads it at
# each snapshot to upload a copy to R2. It need not exist when k3s starts.
readonly etcd_s3_config_secret="k3s-etcd-snapshot-s3-config"
readonly usage="Usage: install-k3s.sh <server|server-edge|edge>"

role="${1:?${usage}}"

if [[ "${EUID}" -ne 0 ]]; then
	echo "install-k3s.sh must run as root" >&2
	exit 1
fi

: "${PUBLIC_IP:?PUBLIC_IP must be the public address of this server}"

# Behind NAT the public address is not on any interface, so the API must be
# advertised on the address the host actually holds.
NODE_IP="${NODE_IP:-$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')}"
: "${NODE_IP:?NODE_IP must be an address assigned to this server}"

write_server_config() {
	cat >"${config_file}" <<CONFIG
cluster-init: true
node-ip: "${NODE_IP}"
advertise-address: "${NODE_IP}"
node-external-ip: "${PUBLIC_IP}"
tls-san:
  - "${PUBLIC_IP}"
flannel-backend: wireguard-native
flannel-external-ip: true
secrets-encryption: true
write-kubeconfig-mode: "0600"
node-label:
  - "svccontroller.k3s.cattle.io/enablelb=true"
etcd-snapshot-schedule-cron: "${etcd_snapshot_schedule}"
etcd-snapshot-retention: ${etcd_snapshot_retention}
etcd-s3: true
etcd-s3-config-secret: "${etcd_s3_config_secret}"
CONFIG
}

write_edge_config() {
	: "${K3S_URL:?K3S_URL must be https://<control plane address>:6443}"
	: "${K3S_TOKEN:?K3S_TOKEN must hold the control plane node token}"
	: "${NODE_NAME:?NODE_NAME must name this edge server}"
	cat >"${config_file}" <<CONFIG
server: "${K3S_URL}"
token: "${K3S_TOKEN}"
node-name: "${NODE_NAME}"
node-ip: "${NODE_IP}"
node-external-ip: "${PUBLIC_IP}"
node-label:
  - "snapflow.io/edge=true"
node-taint:
  - "snapflow.io/edge=true:NoSchedule"
CONFIG
}

prepare_edge_host() {
	printf 'net.core.rmem_max = %s\nnet.core.wmem_max = %s\nnet.ipv4.ip_unprivileged_port_start = 0\n' \
		"${udp_buffer_bytes}" "${udp_buffer_bytes}" >"${edge_sysctl_file}"
	sysctl --load="${edge_sysctl_file}"
	install -d -m 0700 -o "${edge_user_id}" -g "${edge_user_id}" "${edge_state_directory}"
}

install -d -m 0700 "${config_directory}"
umask 077
case "${role}" in
server)
	write_server_config
	install_exec="server"
	;;
server-edge)
	write_server_config
	prepare_edge_host
	install_exec="server"
	;;
edge)
	write_edge_config
	prepare_edge_host
	install_exec="agent"
	;;
*)
	echo "${usage}" >&2
	exit 1
	;;
esac
chmod 0600 "${config_file}"

curl -sfL "${k3s_installer}" | INSTALL_K3S_VERSION="${k3s_version}" INSTALL_K3S_EXEC="${install_exec}" sh -
echo "k3s ${k3s_version} is installed as ${role}"
