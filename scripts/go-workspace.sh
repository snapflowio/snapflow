#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

excluded_modules=()
while [[ ${1:-} == "--exclude" ]]; do
	if (( $# < 2 )); then
		echo "--exclude requires a Go workspace module path" >&2
		exit 2
	fi
	excluded_modules+=("$2")
	shift 2
done

if (( $# == 0 )); then
	echo "usage: $0 [--exclude <module>]... <command> [args...]" >&2
	exit 2
fi

workspace_file="$(go env GOWORK)"
if [[ -z "$workspace_file" || "$workspace_file" == "off" ]]; then
	echo "go.work is not active" >&2
	exit 1
fi

workspace_root="$(dirname "$workspace_file")"
mapfile -t modules < <(
	go work edit -json |
		sed -n 's/^[[:space:]]*"DiskPath": "\(.*\)"[,]\{0,1\}$/\1/p'
)

if (( ${#modules[@]} == 0 )); then
	echo "no modules are declared in $workspace_file" >&2
	exit 1
fi

for module in "${modules[@]}"; do
	for excluded_module in "${excluded_modules[@]}"; do
		if [[ "$module" == "$excluded_module" ]]; then
			continue 2
		fi
	done
	echo "==> $module"
	(cd "$workspace_root/$module" && "$@")
done
