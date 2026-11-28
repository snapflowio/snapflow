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
readonly cluster="${deploy_root}/clusters/production"
readonly cluster_settings="${deploy_root}/clusters/production/cluster-settings.env"
readonly crd_schemas='https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json'
readonly k3s_only_kinds="HelmChartConfig"
readonly substitution_opt_out='.metadata.annotations["kustomize.toolkit.fluxcd.io/substitute"] == "disabled"'
readonly catalog_outdated_kinds="ClusterImagePolicy"
readonly kustomizations=(
	infrastructure/controllers
	infrastructure/openbao-configure
	monitoring
	monitoring/releases
	images
)
readonly substituted_kustomizations=(
	infrastructure/configs
	infrastructure/backups
	platform/data
)

kubeconform_strict() {
	kubeconform -strict -summary -schema-location default -schema-location "${crd_schemas}" -skip "${k3s_only_kinds},${catalog_outdated_kinds}" -
}

substituted() {
	local rendered opted_out
	rendered="$(kubectl kustomize "$1")"
	yq "select((${substitution_opt_out}) | not)" <<<"${rendered}" | flux envsubst --strict
	opted_out="$(yq "select(${substitution_opt_out})" <<<"${rendered}")"
	if [[ -n "${opted_out}" ]]; then
		printf -- '---\n%s\n' "${opted_out}"
	fi
}

missing_dependencies() {
	awk '
		/^kind: / { kind = $2; next }
		/^  name: / && kind == "Kustomization" { defined[$2] = 1; next }
		/^  dependsOn:/ { in_depends = 1; next }
		/^  - name: / && in_depends { needed[$3] = 1; next }
		/^  [a-zA-Z]/ { in_depends = 0 }
		/^---/ { kind = ""; in_depends = 0 }
		END { for (name in needed) if (!(name in defined)) print name }
	'
}

set -a
# shellcheck source=deploy/clusters/production/cluster-settings.env
. "${cluster_settings}"
set +a

for values in "${chart}"/ci/*-values.yaml; do
	component="$(basename "${values}" -values.yaml)"
	echo "Validating ${chart} as ${component}"
	helm lint --strict "${chart}" --values "${values}"
	helm template "${component}" "${chart}" --namespace snapflow --values "${values}" | kubeconform_strict
done
if helm template invalid "${chart}" --set component=unknown >/dev/null 2>&1; then
	echo "error: ${chart} renders without a known component" >&2
	exit 1
fi

for kustomization in "${kustomizations[@]}"; do
	echo "Validating ${deploy_root}/${kustomization}"
	kubectl kustomize "${deploy_root}/${kustomization}" | kubeconform_strict
done
for kustomization in "${substituted_kustomizations[@]}"; do
	echo "Validating ${deploy_root}/${kustomization} with cluster settings"
	substituted "${deploy_root}/${kustomization}" | kubeconform_strict
done

for app in "${deploy_root}"/apps/production/*/; do
	app="$(basename "${app}")"
	echo "Validating ${deploy_root}/apps/production/${app} with cluster settings"
	substituted "${deploy_root}/apps/production/${app}" | kubeconform_strict
	if [[ ! -f "${cluster}/apps/${app}.yaml" ]]; then
		echo "error: ${deploy_root}/apps/production/${app} has no Flux Kustomization in ${cluster}/apps/${app}.yaml" >&2
		exit 1
	fi
done

echo "Validating every stage and app of ${cluster}"
stages="$(mktemp -d)"
trap 'rm -rf "${stages}"' EXIT
cp -r "${cluster}/." "${stages}/"
{
	printf 'apiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n'
	for app in "${cluster}"/apps/*.yaml; do
		[[ "$(basename "${app}")" == "kustomization.yaml" ]] && continue
		printf '  - %s\n' "$(basename "${app}")"
	done
} >"${stages}/apps/kustomization.yaml"
{
	printf 'apiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n'
	for stage in "${cluster}"/*.yaml; do
		[[ "$(basename "${stage}")" == "kustomization.yaml" ]] && continue
		printf '  - %s\n' "$(basename "${stage}")"
	done
	printf '  - apps\ncomponents:\n  - %s\n' "$(realpath --relative-to="${stages}" "${deploy_root}/components/flux-kustomization-defaults")"
} >"${stages}/kustomization.yaml"
kubectl kustomize --load-restrictor LoadRestrictionsNone "${stages}" | kubeconform_strict
rendered="$(kubectl kustomize --load-restrictor LoadRestrictionsNone "${stages}")"
missing="$(missing_dependencies <<<"${rendered}")"
if [[ -n "${missing}" ]]; then
	echo "error: stages depend on Kustomizations that do not exist: ${missing}" >&2
	exit 1
fi

echo "Validating the stages and apps ${cluster} deploys"
rendered="$(kubectl kustomize "${cluster}")"
kubeconform_strict <<<"${rendered}"
missing="$(missing_dependencies <<<"${rendered}")"
if [[ -n "${missing}" ]]; then
	echo "error: ${cluster} deploys stages that depend on stages it does not deploy: ${missing}" >&2
	exit 1
fi

bash "${deploy_root}/scripts/settlement-values.sh" --check

shellcheck --external-sources "${deploy_root}"/scripts/*.sh "${deploy_root}"/infrastructure/openbao-configure/*.sh
