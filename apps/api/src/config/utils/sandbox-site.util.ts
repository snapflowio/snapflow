/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { registrableDomain } from '../../common/utils/registrable-domain.util';

// Sandbox hosts are one label under the platform domain, so the site is taken
// of such a host: once the platform domain is on the Public Suffix List, each
// sandbox host is its own site, which is the goal rather than an error.
const SANDBOX_HOST_LABEL = 'sandbox';

// Guest-controlled content must never share a browser site with Snapflow's own
// origins, or a sandbox could set their cookies and send same-site requests.
export function assertSeparateSandboxSite(
	platformDomain: string,
	platformOrigins: Readonly<Record<string, string | undefined>>
): void {
	const sandboxSite = registrableDomain(
		`${SANDBOX_HOST_LABEL}.${platformDomain}`
	);
	if (sandboxSite === null) {
		throw new Error(
			`SNAPFLOW_PLATFORM_DOMAIN ${platformDomain} has no registrable domain`
		);
	}
	for (const [variable, origin] of Object.entries(platformOrigins)) {
		if (origin && registrableDomain(new URL(origin).hostname) === sandboxSite) {
			throw new Error(
				`SNAPFLOW_PLATFORM_DOMAIN must be a separate site from ${variable}: both belong to ${sandboxSite}`
			);
		}
	}
}
