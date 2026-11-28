/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { SANCTIONED_REGION_MESSAGE } from '../constants/sanctioned-region.constants';
import { SanctionedRegionGuard } from '../guards/sanctioned-region.guard';

export function RefuseSanctionedRegions(): MethodDecorator {
	return applyDecorators(
		UseGuards(SanctionedRegionGuard),
		ApiResponse({
			status: HttpStatus.FORBIDDEN,
			description: SANCTIONED_REGION_MESSAGE,
		})
	);
}
