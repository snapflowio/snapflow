/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'] as const;
const LOOPBACK_HOSTNAME_SET = new Set<string>(LOOPBACK_HOSTNAMES);

export function createTrustedWebOrigins(
	values: readonly (string | undefined)[],
	includeLoopbackAliases: boolean
): string[] {
	const origins = new Set<string>();

	for (const value of values) {
		if (!value) continue;
		const parsed = new URL(value);
		origins.add(parsed.origin);
		if (
			!includeLoopbackAliases ||
			!LOOPBACK_HOSTNAME_SET.has(parsed.hostname)
		) {
			continue;
		}
		for (const hostname of LOOPBACK_HOSTNAMES) {
			const alias = new URL(parsed.origin);
			alias.hostname = hostname;
			origins.add(alias.origin);
		}
	}

	return [...origins];
}
