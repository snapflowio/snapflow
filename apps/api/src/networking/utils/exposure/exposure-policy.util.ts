/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import type { ExposurePolicyDto } from '../../dto/exposure.dto';
import { PublicIngressDisabledException } from '../../exceptions/public-ingress-disabled.exception';
import { isPublicExposurePolicy } from './public-ingress-policy.util';

export function normalizeExposurePolicy(
	policy: ExposurePolicyDto
): ExposurePolicyDto {
	if (policy.protocol !== NETWORK_PROTOCOL.HTTP) return { ...policy };
	return {
		...policy,
		allowedOrigins: [
			...new Set(policy.allowedOrigins.map((origin) => new URL(origin).origin)),
		].sort(),
	};
}

export function assertPublicIngressAllowed(
	policy: ExposurePolicyDto,
	publicIngressEnabled: boolean
): void {
	if (isPublicExposurePolicy(policy) && !publicIngressEnabled) {
		throw new PublicIngressDisabledException();
	}
}
