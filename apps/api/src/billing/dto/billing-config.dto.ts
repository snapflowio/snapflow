/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { MicroUsd } from '../../common/values/micro-usd.value';
import type { SettingsSnapshot } from '../../settings/types/settings.types';
import { MAXIMUM_MARKUP_BASIS_POINTS } from '../../settlement/constants/settlement.constants';

@ApiSchema({ name: 'BillingConfig' })
export class BillingConfigDto {
	@ApiProperty({
		description:
			'Markup added on top of the host price of every machine rented from another organization, in basis points of the host price',
		maximum: MAXIMUM_MARKUP_BASIS_POINTS,
	})
	markupBasisPoints: number;

	@ApiProperty({
		description:
			'Snapflow storage rate per GiB-month of compressed stored bytes (archives, snapshots, templates, volume backups), micro-USD',
	})
	storageMicroUsdPerGibMonth: string;

	@ApiProperty({
		description: 'Smallest escrow deposit, micro-USD',
	})
	minimumDepositMicroUsd: string;

	static from(settings: SettingsSnapshot): BillingConfigDto {
		return {
			markupBasisPoints: settings.markupBasisPoints,
			storageMicroUsdPerGibMonth: String(settings.storageMicroUsdPerGibMonth),
			minimumDepositMicroUsd: MicroUsd.fromCents(
				settings.minimumDepositCents
			).toString(),
		};
	}
}
