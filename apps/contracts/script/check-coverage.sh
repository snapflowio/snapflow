#!/usr/bin/env bash
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

# Measures line and branch coverage of src/ and fails below the minimums. The minimums sit just under the current
# coverage, so a change that adds untested code fails; raise them when coverage improves. Run from apps/contracts.
#
# Usage: check-coverage.sh [lcov report path]

set -euo pipefail

readonly report="${1:-lcov.info}"
readonly min_line_percent=98
readonly min_branch_percent=78

FOUNDRY_PROFILE=lite forge coverage --report summary --report lcov --report-file "${report}" \
	--no-match-coverage '^(test|script)/'

# LF/LH and BRF/BRH are each file's found and hit lines and branches.
read -r lines_found lines_hit branches_found branches_hit < <(awk -F: '
	$1 == "LF" { lf += $2 } $1 == "LH" { lh += $2 } $1 == "BRF" { bf += $2 } $1 == "BRH" { bh += $2 }
	END { print lf + 0, lh + 0, bf + 0, bh + 0 }
' "${report}")

check() {
	local name="$1" hit="$2" found="$3" minimum="$4"
	if ((found == 0 || hit * 100 < minimum * found)); then
		echo "error: ${name} coverage ${hit}/${found} is below ${minimum}%" >&2
		return 1
	fi
	echo "${name} coverage ${hit}/${found} meets ${minimum}%"
}

status=0
check line "${lines_hit}" "${lines_found}" "${min_line_percent}" || status=1
check branch "${branches_hit}" "${branches_found}" "${min_branch_percent}" || status=1
exit "${status}"
