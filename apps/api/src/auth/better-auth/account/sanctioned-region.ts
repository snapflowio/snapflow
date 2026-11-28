/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { APIError } from 'better-auth/api';
import { CLIENT_IP_HEADER } from '../../../common/constants/client-ip.constants';
import type { GeoIpService } from '../../../location/services/geo-ip.service';
import { AUTH_ERROR } from '../../constants/auth-errors.constants';

export interface SanctionedRegionDependencies {
	geoIp: Pick<GeoIpService, 'inSanctionedRegion'>;
}

export function assertSignUpRegionAllowed(
	{ geoIp }: SanctionedRegionDependencies,
	headers: Headers | undefined
): void {
	const clientIp = headers?.get(CLIENT_IP_HEADER) ?? undefined;
	if (geoIp.inSanctionedRegion(clientIp)) {
		throw APIError.from('FORBIDDEN', AUTH_ERROR.SANCTIONED_REGION);
	}
}
