/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'HostEarningsMaturity' })
export class HostEarningsMaturityDto {
	@ApiProperty({
		type: String,
		format: 'date',
		description: 'UTC day the earnings become available',
	})
	maturesOn: string;

	@ApiProperty() amountMicroUsd: string;
}

@ApiSchema({ name: 'HostEarnings' })
export class HostEarningsDto {
	@ApiProperty({ description: 'Earnings still inside their payout hold' })
	pendingMicroUsd: string;

	@ApiProperty({ description: 'Earnings available for the next payout' })
	availableMicroUsd: string;

	@ApiProperty({ description: 'Earnings committed to a transfer in flight' })
	inTransferMicroUsd: string;

	@ApiProperty({ type: String, format: 'date-time' })
	nextPayoutDate: Date;

	@ApiProperty() payoutMinimumCents: number;

	@ApiProperty({ type: HostEarningsMaturityDto, isArray: true })
	maturing: HostEarningsMaturityDto[];
}
