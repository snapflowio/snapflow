/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import type { SettingsSnapshot } from '../../settings/types/settings.types';

@ApiSchema({ name: 'BillingConfig' })
export class BillingConfigDto {
	@ApiProperty({
		description:
			'Markup added to host prices, in basis points of the host price',
		maximum: BASIS_POINTS_SCALE,
	})
	platformMarkupBasisPoints: number;

	static from(settings: SettingsSnapshot): BillingConfigDto {
		return {
			platformMarkupBasisPoints: settings.platformMarkupBasisPoints,
		};
	}
}
