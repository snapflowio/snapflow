/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { AuthenticationError, PermissionDeniedError } from 'cloudflare';
import { ingressUnavailable } from './ingress-unavailable.util';

export const CLOUDFLARE_TOKEN_VARIABLE = 'SNAPFLOW_CLOUDFLARE_API_TOKEN';

export async function cloudflareRequest<Result>(
	permission: string,
	action: string,
	request: () => Promise<Result>
): Promise<Result> {
	try {
		return await request();
	} catch (error) {
		if (error instanceof AuthenticationError) {
			throw ingressUnavailable(
				`Cloudflare rejected ${CLOUDFLARE_TOKEN_VARIABLE} while trying to ${action}: replace the token`
			);
		}
		if (error instanceof PermissionDeniedError) {
			throw ingressUnavailable(
				`${CLOUDFLARE_TOKEN_VARIABLE} may not ${action}: grant it ${permission} on the platform domain's zone`
			);
		}
		throw error;
	}
}
