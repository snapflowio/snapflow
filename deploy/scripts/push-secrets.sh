#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

# shellcheck source=deploy/scripts/lib/openbao-session.sh
. "deploy/scripts/lib/openbao-session.sh"

readonly source_directory="deploy/secrets/production"
readonly edges_directory="edges"
readonly edge_schema="edges"
readonly env_extension=".env"
readonly kv_mount="secret"
readonly kv_prefix="snapflow"
readonly missing_secret_message="No value found"
readonly secret_line_pattern='^([A-Za-z_][A-Za-z0-9_.-]*)=(.*)$'
readonly comment_line_pattern='^[[:space:]]*(#.*)?$'
# shellcheck disable=SC2016
readonly pairs_to_object='[inputs] as $lines | reduce range(0; $lines | length; 2) as $index ({}; .[$lines[$index]] = $lines[$index + 1])'
declare -rA required_keys=(
	[api]="BETTER_AUTH_SECRETS RESEND_API_KEY SNAPFLOW_CLOUDFLARE_API_TOKEN SNAPFLOW_CLOUDFLARE_WEBHOOK_SECRET STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY STRIPE_PLATFORM_WEBHOOK_SECRET STRIPE_CONNECT_WEBHOOK_SECRET"
	[alerts]="discord-webhook-url"
	[backups]="access-key-id secret-access-key"
	[cloudflare-dns]="api-token"
	[edges]="id enrollment-secret"
)
declare -rA optional_keys=(
	[api]="HEALTH_CHECK_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET"
)

failures=0
declare -A payloads=()

fail() {
	echo "$*" >&2
	failures=$((failures + 1))
}

unquote() {
	local value="$1"
	if ((${#value} >= 2)) && [[ "${value:0:1}" == "${value: -1}" && ("${value:0:1}" == '"' || "${value:0:1}" == "'") ]]; then
		value="${value:1:${#value}-2}"
	fi
	printf '%s' "${value}"
}

load_secret_file() {
	local file="$1" schema="$2" path="$3"
	local -A allowed=() seen=() values=()
	local -a pairs=()
	local line key value number=0

	for key in ${required_keys[${schema}]} ${optional_keys[${schema}]:-}; do
		allowed["${key}"]=1
	done

	while IFS= read -r line || [[ -n "${line}" ]]; do
		number=$((number + 1))
		line="${line%$'\r'}"
		[[ "${line}" =~ ${comment_line_pattern} ]] && continue
		if [[ ! "${line}" =~ ${secret_line_pattern} ]]; then
			fail "${file}:${number}: expected KEY=VALUE"
			continue
		fi
		key="${BASH_REMATCH[1]}"
		value="$(unquote "${BASH_REMATCH[2]}")"
		if [[ -z "${allowed[${key}]+set}" ]]; then
			fail "${file}:${number}: ${key} is not a ${schema} secret; non-secret settings come from the Helm chart"
		elif [[ -n "${seen[${key}]+set}" ]]; then
			fail "${file}:${number}: ${key} is set more than once"
		else
			seen["${key}"]=1
			if [[ -n "${value}" ]]; then
				values["${key}"]=1
				pairs+=("${key}" "${value}")
			fi
		fi
	done <"${file}"

	for key in ${required_keys[${schema}]}; do
		[[ -n "${values[${key}]+set}" ]] || fail "${file}: ${key} is required"
	done

	if ((${#pairs[@]} == 0)); then
		payloads["${path}"]='{}'
	else
		payloads["${path}"]="$(printf '%s\n' "${pairs[@]}" | jq -cSRn "${pairs_to_object}")"
	fi
}

collect_secrets() {
	if [[ ! -d "${source_directory}" ]]; then
		echo "${source_directory} does not exist; see Secrets in docs/deployment.md." >&2
		exit 1
	fi
	if [[ -n "$(git ls-files -- "${source_directory}")" ]]; then
		fail "${source_directory} is tracked by git; remove it from the index before pushing secrets"
	fi

	local file relative name schema
	while IFS= read -r -d '' file; do
		fail "${file} is readable by other users; run chmod 600 on it"
	done < <(find "${source_directory}" -type f -perm /077 -print0)

	for schema in "${!required_keys[@]}"; do
		[[ "${schema}" == "${edge_schema}" ]] && continue
		[[ -f "${source_directory}/${schema}${env_extension}" ]] || fail "${source_directory}/${schema}${env_extension} is missing"
	done

	while IFS= read -r -d '' file; do
		relative="${file#"${source_directory}"/}"
		name="${relative%"${env_extension}"}"
		if [[ "${relative}" != *"${env_extension}" ]]; then
			schema=""
		elif [[ "${name}" == "${edges_directory}/"* && "${name#"${edges_directory}"/}" != */* ]]; then
			schema="${edge_schema}"
		elif [[ "${name}" != */* && "${name}" != "${edge_schema}" && -n "${required_keys[${name}]+set}" ]]; then
			schema="${name}"
		else
			schema=""
		fi
		if [[ -z "${schema}" ]]; then
			fail "${file} is not a known secrets file"
			continue
		fi
		load_secret_file "${file}" "${schema}" "${kv_prefix}/${name}"
	done < <(find "${source_directory}" -type f -print0 | sort -z)

	if ((failures > 0)); then
		echo "Nothing was pushed: ${failures} problem(s) found." >&2
		exit 1
	fi
}

current_secret() {
	local path="$1" output
	if output="$(bao kv get -mount="${kv_mount}" -format=json "${path}" 2>&1)"; then
		printf '%s' "${output}" | jq -cS '.data.data // {}'
	elif [[ "${output}" == *"${missing_secret_message}"* ]]; then
		echo '{}'
	else
		echo "${output}" >&2
		return 1
	fi
}

push_secrets() {
	local path changed=0
	openbao_session_open
	while IFS= read -r path; do
		if [[ "$(current_secret "${path}")" == "${payloads[${path}]}" ]]; then
			echo "${path}: unchanged"
		else
			printf '%s' "${payloads[${path}]}" | bao kv put -mount="${kv_mount}" "${path}" - >/dev/null
			echo "${path}: updated"
			changed=$((changed + 1))
		fi
	done < <(printf '%s\n' "${!payloads[@]}" | sort)

	if ((changed > 0)); then
		kubectl annotate externalsecrets.external-secrets.io --all --all-namespaces "force-sync=$(date +%s)" --overwrite >/dev/null
		echo "Requested an immediate External Secrets sync; Reloader restarts the workloads whose secrets changed."
	fi
}

collect_secrets
push_secrets
