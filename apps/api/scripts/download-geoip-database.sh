#!/usr/bin/env sh
# Copyright (c) 2026 Snapflow. All rights reserved.
#
# Snapflow is licensed under the GNU Affero General Public License v3.0.
# You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
#
# SPDX-License-Identifier: AGPL-3.0

set -eu

if [ "$#" -ne 1 ]; then
	echo "usage: $0 <output.mmdb>" >&2
	exit 2
fi

output=$1
download_base=https://download.db-ip.com/free/dbip-city-lite

year=$(date -u +%Y)
month=$(date -u +%m)
previous_year=$year
previous_month=$((${month#0} - 1))
if [ "$previous_month" -eq 0 ]; then
	previous_month=12
	previous_year=$((year - 1))
fi
previous=$(printf '%04d-%02d' "$previous_year" "$previous_month")

mkdir -p "$(dirname "$output")"
partial="$output.partial"
trap 'rm -f "$partial" "$partial.gz"' EXIT

for edition in "$year-$month" "$previous"; do
	if wget -q -O "$partial.gz" "$download_base-$edition.mmdb.gz"; then
		gunzip -f "$partial.gz"
		mv "$partial" "$output"
		echo "DB-IP City Lite $edition saved to $output"
		exit 0
	fi
done

echo "could not download DB-IP City Lite for $year-$month or $previous" >&2
exit 1
