/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { registrableDomain } from '../../common/utils/registrable-domain.util';

export function passkeyRpId(websiteUrl: string): string {
	const { hostname } = new URL(websiteUrl);
	return registrableDomain(hostname) ?? hostname;
}
