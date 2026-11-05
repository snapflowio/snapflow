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
	@ApiProperty({ type: [Number], description: 'Suggested top-ups, cents' })
	topUpPresetsCents: number[];

	@ApiProperty({ description: 'Smallest top-up, cents' })
	topUpMinimumCents: number;

	@ApiProperty({ description: 'Largest top-up, cents' })
	topUpMaximumCents: number;

	@ApiProperty({ description: 'Smallest automatic top-up, cents' })
	autoTopUpMinimumCents: number;

	@ApiProperty({ description: 'Minutes between automatic top-up attempts' })
	autoTopUpMinimumIntervalMinutes: number;

	@ApiProperty({
		type: [String],
		description: 'ISO 3166-1 alpha-2 countries hosts may be paid in',
	})
	payoutCountries: string[];

	@ApiProperty({
		description:
			'Markup added to host prices, in basis points of the host price',
		maximum: BASIS_POINTS_SCALE,
	})
	platformMarkupBasisPoints: number;

	static from(settings: SettingsSnapshot): BillingConfigDto {
		return {
			topUpPresetsCents: [...settings.topUpPresetsCents],
			topUpMinimumCents: settings.topUpMinimumCents,
			topUpMaximumCents: settings.topUpMaximumCents,
			autoTopUpMinimumCents: settings.autoTopUpMinimumCents,
			autoTopUpMinimumIntervalMinutes: settings.autoTopUpMinimumIntervalMinutes,
			payoutCountries: [...settings.payoutCountries],
			platformMarkupBasisPoints: settings.platformMarkupBasisPoints,
		};
	}
}
