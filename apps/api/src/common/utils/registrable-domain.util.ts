/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { getDomain } from 'tldts';

// The registrable domain (eTLD+1) is what browsers treat as a site for
// cookies and SameSite; private Public Suffix List entries count as suffixes.
export function registrableDomain(hostname: string): string | null {
	return getDomain(hostname, { allowPrivateDomains: true });
}
