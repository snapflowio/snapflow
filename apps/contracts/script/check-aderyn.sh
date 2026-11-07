#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Runs Aderyn over src/ (aderyn.toml) and fails on any high or low finding, listing them. Run from apps/contracts.
#
# Usage: check-aderyn.sh [report path]

set -euo pipefail

readonly report="${1:-aderyn-report.json}"

aderyn --output "${report}" .
if ! jq -e '.issue_count.high == 0 and .issue_count.low == 0' "${report}" >/dev/null; then
	echo "error: Aderyn found issues in src/:" >&2
	jq -r '(.high_issues.issues + .low_issues.issues)[] | .detector_name as $name
		| .instances[] | "  \($name) \(.contract_path):\(.line_no)"' "${report}" >&2
	exit 1
fi
echo "Aderyn found no high or low issues"
