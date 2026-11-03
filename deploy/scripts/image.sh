#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

readonly usage="Usage: image.sh <build|publish>"
readonly bake_file="docker-bake.hcl"
readonly builder="snapflow"
readonly local_tag="local"
readonly release_ref="origin/dev"
readonly metadata_directory="dist/images"
readonly digest_key="containerimage.digest"
readonly cache_tag="buildcache"
readonly candidate_prefix="candidate"
readonly release_prefix="build"
# Fixable findings at these severities block the publish; findings without a
# fix are reported, and accepted risks are listed with a reason and an expiry
# in the ignore file.
readonly scanned_severities="CRITICAL,HIGH"
readonly trivy_ignore_file=".trivyignore.yaml"

mode="${1:?${usage}}"
application="${MOON_PROJECT_ID:?Run this through moon, for example moon run api:publish}"
revision="$(git rev-parse HEAD)"

if ! docker buildx inspect "${builder}" >/dev/null 2>&1; then
	docker buildx create --name "${builder}" --driver docker-container >/dev/null
fi
export BUILDX_BUILDER="${builder}"

repository="$(docker buildx bake --file "${bake_file}" --print "${application}" | jq --exit-status --raw-output --arg target "${application}" '.target[$target].tags[0] | sub(":[^:/]+$"; "")')"

build() {
	IMAGE_TAG="${local_tag}" SNAPFLOW_SOURCE_REVISION="${revision}" \
		docker buildx bake --file "${bake_file}" --load "${application}"
	echo "Built ${repository}:${local_tag}"
}

publish() {
	if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
		echo "Publishing requires a clean working tree; commit the changes first" >&2
		exit 1
	fi
	if ! git merge-base --is-ancestor HEAD "${release_ref}"; then
		echo "Publishing requires a commit that is on ${release_ref}; merge it into dev and fetch first" >&2
		exit 1
	fi
	local timestamp candidate release metadata digest
	# The commit time, not the build time, orders the tags Flux deploys, so
	# rebuilding an older commit never outranks newer code.
	timestamp="$(git show --no-patch --format=%ct HEAD)"
	candidate="${candidate_prefix}-${revision}-${timestamp}"
	release="${release_prefix}-${revision}-${timestamp}"
	metadata="${metadata_directory}/${application}.json"
	mkdir -p "${metadata_directory}"
	IMAGE_TAG="${candidate}" SNAPFLOW_SOURCE_REVISION="${revision}" \
		docker buildx bake --file "${bake_file}" --push --metadata-file "${metadata}" \
		--set "${application}.cache-to=type=registry,ref=${repository}:${cache_tag},mode=max" \
		--set "${application}.attest=type=provenance,mode=max" \
		--set "${application}.attest=type=sbom" \
		"${application}"
	digest="$(jq --exit-status --raw-output --arg target "${application}" --arg key "${digest_key}" '.[$target][$key]' "${metadata}")"
	trivy image --scanners vuln --severity "${scanned_severities}" --ignorefile "${trivy_ignore_file}" \
		--exit-code 0 "${repository}@${digest}"
	trivy image --scanners vuln --severity "${scanned_severities}" --ignorefile "${trivy_ignore_file}" \
		--ignore-unfixed --exit-code 1 --quiet "${repository}@${digest}"
	docker buildx imagetools create --tag "${repository}:${release}" "${repository}@${digest}"
	jq --arg target "${application}" --arg image "${repository}:${release}" '.[$target]["image.name"] = $image' "${metadata}" >"${metadata}.next"
	mv "${metadata}.next" "${metadata}"
	echo "Published ${repository}:${release}@${digest}"
}

case "${mode}" in
build) build ;;
publish) publish ;;
*)
	echo "${usage}" >&2
	exit 1
	;;
esac
