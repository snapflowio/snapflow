#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Installs the Flux Operator and the FluxInstance in deploy/clusters/production/
# flux-system. Flux syncs this repository as the snapflowio-automation GitHub App,
# so no deploy key is created; after this, Flux manages the operator and itself.
#
# First installation of a production cluster, in order:
#  1. Cloudflare and Resend records for the domains in
#     deploy/clusters/production/cluster-settings.env (each is described there),
#     and a Zone:DNS:Edit API token for certificates and dynamic DNS.
#  2. Router: a DHCP reservation for the server, and port forwards for TCP 80,
#     443, 8443 and UDP 8443 (edge) and TCP 9443 (site, registry and storage),
#     nothing else.
#  3. On the server: deploy/bootstrap/install-k3s.sh, then
#     deploy/bootstrap/host-firewall.sh; copy /etc/rancher/k3s/k3s.yaml into
#     the workstation's kubeconfig with the server's address.
#  4. SNAPFLOW_AUTOMATION_PRIVATE_KEY_FILE=<app key .pem> moon run deploy:bootstrap
#     (this script). Back up the printed OpenBao seal key offline.
#  5. moon run deploy:openbao and create the secrets it lists.
#  6. Each edge: register it with the admin API (POST /api/admin/edges, then
#     POST /api/admin/edges/:id/enrollment-secret), store snapflow/edges/<name>
#     in OpenBao and add {name, node} to edges in deploy/apps/production/snapflow.yaml.
#  7. After the first image publish, make each ghcr.io/snapflowio/snapflow/*
#     package public (Package settings > Change visibility), so neither the
#     cluster nor Flux needs a registry token.
#  8. Deploy the escrow on Base (apps/contracts/script/DeployEscrow.s.sol) and
#     set its address and deployment block, and the Reown Cloud project id,
#     under settlement in deploy/apps/production/snapflow.yaml.
# Flux retries each stage until its prerequisites exist, so steps 5 to 8 may
# come in any order. moon run deploy:status shows progress.

set -euo pipefail

readonly flux_namespace="flux-system"
readonly flux_system_directory="deploy/clusters/production/flux-system"
readonly operator_manifest="${flux_system_directory}/flux-operator.yaml"
readonly flux_instance_manifest="${flux_system_directory}/flux-instance.yaml"
readonly operator_release="flux-operator"
readonly operator_chart="oci://ghcr.io/controlplaneio-fluxcd/charts/flux-operator"
readonly flux_instance="fluxinstance/flux"
readonly ready_timeout="10m"
# The FluxInstance sync reads this secret (pullSecret, provider: github).
readonly github_app_secret="flux-system"
# Public identifiers of the snapflowio-automation GitHub App; its private key
# is read from SNAPFLOW_AUTOMATION_PRIVATE_KEY_FILE and only stored in the cluster.
readonly github_app_id="5586776"
readonly github_app_installation_id="178044091"
readonly seal_namespace="openbao"
readonly seal_secret="openbao-seal"
readonly seal_key_bytes=32

: "${SNAPFLOW_AUTOMATION_PRIVATE_KEY_FILE:?set SNAPFLOW_AUTOMATION_PRIVATE_KEY_FILE to the snapflowio-automation GitHub App private key (.pem)}"
if [[ ! -r "${SNAPFLOW_AUTOMATION_PRIVATE_KEY_FILE}" ]]; then
	echo "cannot read ${SNAPFLOW_AUTOMATION_PRIVATE_KEY_FILE}" >&2
	exit 1
fi
operator_version="$(sed -n 's/^    tag: \(.*\)$/\1/p' "${operator_manifest}")"
if [[ -z "${operator_version}" ]]; then
	echo "no operator chart version in ${operator_manifest}" >&2
	exit 1
fi
kubectl cluster-info >/dev/null

kubectl create namespace "${seal_namespace}" --dry-run=client --output yaml | kubectl apply --filename -
if ! kubectl --namespace "${seal_namespace}" get secret "${seal_secret}" >/dev/null 2>&1; then
	kubectl --namespace "${seal_namespace}" create secret generic "${seal_secret}" \
		--from-file=key=<(head -c "${seal_key_bytes}" /dev/urandom)
	echo "Created the OpenBao seal key. Back it up now and keep it offline:"
	echo "  kubectl --namespace ${seal_namespace} get secret ${seal_secret} --output jsonpath='{.data.key}'"
fi

kubectl create namespace "${flux_namespace}" --dry-run=client --output yaml | kubectl apply --filename -
helm upgrade --install "${operator_release}" "${operator_chart}" \
	--namespace "${flux_namespace}" \
	--version "${operator_version}" \
	--wait
flux create secret githubapp "${github_app_secret}" \
	--namespace "${flux_namespace}" \
	--app-id="${github_app_id}" \
	--app-installation-id="${github_app_installation_id}" \
	--app-private-key="${SNAPFLOW_AUTOMATION_PRIVATE_KEY_FILE}"
kubectl apply --filename "${flux_instance_manifest}"
kubectl --namespace "${flux_namespace}" wait "${flux_instance}" --for=condition=Ready --timeout="${ready_timeout}"
echo "Flux is installed and syncs ${flux_system_directory%/flux-system} as the snapflowio-automation GitHub App."
