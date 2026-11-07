#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

readonly deploy_root="deploy"
readonly chart="${deploy_root}/charts/snapflow"
readonly chart_values="${chart}/ci/production-values.yaml"
readonly cluster_settings="${deploy_root}/clusters/production/cluster-settings.env"
readonly crd_schemas='https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json'
readonly k3s_only_kinds="HelmChartConfig"
readonly kustomizations=(
	clusters/production/flux-system
	infrastructure/controllers
	platform/openbao-configure
	platform/jobs
	images
)
readonly substituted_kustomizations=(
	infrastructure/configs
	platform/data
	platform/backups
	apps/production
)

kubeconform_strict() {
	kubeconform -strict -summary -schema-location default -schema-location "${crd_schemas}" -skip "${k3s_only_kinds}" -
}

set -a
# shellcheck source=deploy/clusters/production/cluster-settings.env
. "${cluster_settings}"
set +a

helm lint --strict "${chart}" --values "${chart_values}"
helm template snapflow "${chart}" --namespace snapflow --values "${chart_values}" | kubeconform_strict

for kustomization in "${kustomizations[@]}"; do
	echo "Validating ${deploy_root}/${kustomization}"
	kubectl kustomize "${deploy_root}/${kustomization}" | kubeconform_strict
done
for kustomization in "${substituted_kustomizations[@]}"; do
	echo "Validating ${deploy_root}/${kustomization} with cluster settings"
	kubectl kustomize "${deploy_root}/${kustomization}" | flux envsubst --strict | kubeconform_strict
done
kubeconform_strict <"${deploy_root}/clusters/production/stages.yaml"

bash "${deploy_root}/scripts/settlement-values.sh" --check

shellcheck --external-sources "${deploy_root}"/scripts/*.sh "${deploy_root}"/bootstrap/*.sh "${deploy_root}"/platform/openbao-configure/*.sh
