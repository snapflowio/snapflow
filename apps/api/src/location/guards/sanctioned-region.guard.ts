/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { apiError } from '../../common/utils/error/api-error.util';
import {
	LocationErrorCode,
	SANCTIONED_REGION_MESSAGE,
} from '../constants/sanctioned-region.constants';
import { GeoIpService } from '../services/geo-ip.service';

@Injectable()
export class SanctionedRegionGuard implements CanActivate {
	constructor(private readonly geoIp: GeoIpService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request>();
		if (this.geoIp.inSanctionedRegion(request.ip)) {
			throw new ForbiddenException(
				apiError(LocationErrorCode.SANCTIONED_REGION, SANCTIONED_REGION_MESSAGE)
			);
		}
		return true;
	}
}
