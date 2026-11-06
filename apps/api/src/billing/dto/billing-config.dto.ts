/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { SettingsSnapshot } from '../../settings/types/settings.types';
import { ESCROW_MAXIMUM_FEE_BASIS_POINTS } from '../../settlement/constants/settlement.constants';

@ApiSchema({ name: 'BillingConfig' })
export class BillingConfigDto {
	@ApiProperty({
		description:
			'Markup added to the host price of machines below the Verified tier, in basis points of the host price',
		maximum: ESCROW_MAXIMUM_FEE_BASIS_POINTS,
	})
	standardMarkupBasisPoints: number;

	@ApiProperty({
		description:
			'Markup added to the host price of Verified and Datacenter machines, in basis points of the host price',
		maximum: ESCROW_MAXIMUM_FEE_BASIS_POINTS,
	})
	verifiedMarkupBasisPoints: number;

	@ApiProperty({
		description:
			"Monthly fee per machine kept in the private pool, micro-USD, prorated by UTC day; the organization's own machines carry no markup",
	})
	privatePoolMachineMonthlyMicroUsd: string;

	static from(settings: SettingsSnapshot): BillingConfigDto {
		return {
			standardMarkupBasisPoints: settings.standardMarkupBasisPoints,
			verifiedMarkupBasisPoints: settings.verifiedMarkupBasisPoints,
			privatePoolMachineMonthlyMicroUsd: String(
				settings.privatePoolMachineMonthlyMicroUsd
			),
		};
	}
}
