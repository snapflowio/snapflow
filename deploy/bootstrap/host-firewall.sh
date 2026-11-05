#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Applies the host firewall of a k3s server with UFW, after install-k3s.sh.
# The rules here are the whole firewall: each run resets
# UFW and applies exactly this set, so a second run changes nothing and a rule
# added by hand is removed. The router is the outer wall and forwards only the
# public ports below; this is the second wall if it ever forwards more.
#
# Public: the edge (80, 443 and 8443 TCP, 8443 UDP for QUIC machine tunnels)
# and Traefik (9443, behind Cloudflare and for the registry and storage).
# Administrative network only: SSH (rate limited) and the k3s API.
# The k3s pod and service networks are allowed, as k3s requires with UFW.
#
# Usage: sudo ADMIN_CIDR=192.168.40.0/24 deploy/bootstrap/host-firewall.sh [--dry-run]
# ADMIN_CIDR defaults to the network of the default route's interface. From a
# workstation: ssh -t <server> 'sudo bash -s' < deploy/bootstrap/host-firewall.sh
# Only Traefik's 9443 and the edge should appear in the closing list of ports
# that bypass UFW.

set -euo pipefail

readonly usage="Usage: sudo [ADMIN_CIDR=<cidr>] host-firewall.sh [--dry-run]"
readonly k3s_pod_cidr="10.42.0.0/16"
readonly k3s_service_cidr="10.43.0.0/16"
readonly public_tcp_ports=(80 443 8443 9443)
readonly public_udp_ports=(8443)
readonly ssh_port=22
readonly kubernetes_api_port=6443
# Remote administration through Tailscale, when the machine runs it.
readonly tailscale_interface="tailscale0"

dry_run=false
case "${1:-}" in
"") ;;
--dry-run) dry_run=true ;;
*)
	echo "${usage}" >&2
	exit 1
	;;
esac

if [[ "${EUID}" -ne 0 ]]; then
	echo "host-firewall.sh must run as root" >&2
	exit 1
fi
command -v ufw >/dev/null || {
	echo "ufw is not installed (apt install ufw)" >&2
	exit 1
}

default_interface="$(ip -4 route show default | awk '{for (i = 1; i < NF; i++) if ($i == "dev") print $(i + 1); exit}')"
ADMIN_CIDR="${ADMIN_CIDR:-$(ip -4 -o route show dev "${default_interface}" scope link | awk '{print $1; exit}')}"
: "${ADMIN_CIDR:?set ADMIN_CIDR to the network allowed to administer this server}"

rule() {
	if [[ "${dry_run}" == true ]]; then
		echo "ufw $*"
	else
		ufw "$@" >/dev/null
	fi
}

echo "Administrative network: ${ADMIN_CIDR}"
if [[ "${dry_run}" == false ]]; then
	ufw --force reset >/dev/null
fi
rule default deny incoming
rule default allow outgoing
# k3s, Docker and Snapflow insert their own forwarding rules ahead of UFW's;
# everything else routed through the host is dropped.
rule default deny routed
rule logging low

rule limit from "${ADMIN_CIDR}" to any port "${ssh_port}" proto tcp comment "SSH"
rule allow from "${ADMIN_CIDR}" to any port "${kubernetes_api_port}" proto tcp comment "k3s API"
if ip link show "${tailscale_interface}" >/dev/null 2>&1; then
	rule limit in on "${tailscale_interface}" to any port "${ssh_port}" proto tcp comment "SSH over Tailscale"
	rule allow in on "${tailscale_interface}" to any port "${kubernetes_api_port}" proto tcp comment "k3s API over Tailscale"
fi

for port in "${public_tcp_ports[@]}"; do
	rule allow "${port}/tcp" comment "public"
done
for port in "${public_udp_ports[@]}"; do
	rule allow "${port}/udp" comment "public"
done

for cidr in "${k3s_pod_cidr}" "${k3s_service_cidr}"; do
	rule allow from "${cidr}" comment "k3s"
	rule route allow from "${cidr}" comment "k3s"
	rule route allow to "${cidr}" comment "k3s"
done

if [[ "${dry_run}" == true ]]; then
	exit 0
fi
ufw --force enable >/dev/null
ufw status verbose

# Docker-published ports and k3s NodePort, LoadBalancer and host ports are
# DNAT-ed before UFW sees the packet, so UFW rules do not restrict them; list
# them so each one is a deliberate choice.
echo
echo "Reachable regardless of UFW (restrict these at the router or in their own configuration):"
if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
	docker ps --filter "publish=1-65535" --format '  docker {{.Names}}: {{.Ports}}' || true
fi
if command -v k3s >/dev/null; then
	k3s kubectl get services --all-namespaces --no-headers \
		--output custom-columns='NS:.metadata.namespace,NAME:.metadata.name,TYPE:.spec.type,PORTS:.spec.ports[*].port' 2>/dev/null |
		awk '$3 == "NodePort" || $3 == "LoadBalancer" {print "  service " $1 "/" $2 " (" $3 "): " $4}' || true
	k3s kubectl get pods --all-namespaces --no-headers \
		--output custom-columns='NS:.metadata.namespace,NAME:.metadata.name,HOSTNET:.spec.hostNetwork,HOSTPORTS:.spec.containers[*].ports[*].hostPort' 2>/dev/null |
		awk '$3 == "true" || ($4 != "<none>" && $4 != "") {print "  pod " $1 "/" $2 " (hostNetwork " $3 ", hostPorts " $4 ")"}' || true
fi
