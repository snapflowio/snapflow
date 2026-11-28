/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';
import type { Address, Hash, Hex } from 'viem';
import { PageLimit } from '../../common/decorators/page-limit.decorator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import { HOST_PAYOUT_QUERY } from '../constants/escrow.constants';
import {
	EVM_ADDRESS_API_PROPERTY,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';

const DATE_PROPERTY = { type: String, format: 'date-time' } as const;

@ApiSchema({ name: 'HostPayoutClaim' })
export class HostPayoutClaimDto {
	@ApiProperty({ type: String, description: 'The payment channel claimed' })
	channelId: Hex;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: "The machine's share of the claim after the fee, in micro-USD",
	})
	amountMicroUsd: string;

	@ApiProperty(DATE_PROPERTY)
	claimedAt: Date;

	@ApiProperty({ type: String })
	transactionHash: Hash;
}

@ApiSchema({ name: 'HostPayout' })
export class HostPayoutDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({
		format: 'uuid',
		nullable: true,
		type: String,
		description:
			'The machine whose host key was paid out; null once the key is gone',
	})
	machineId: string | null;

	@ApiProperty({ type: String, nullable: true })
	machineName: string | null;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The host key paid out',
	})
	hostAddress: Address;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The wallet the payout went to',
	})
	payoutAddress: Address;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Net plus the network fee, in micro-USD',
	})
	grossMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Network fee the payout paid its relayer, in micro-USD',
	})
	feeMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'What reached the payout wallet, in micro-USD',
	})
	netMicroUsd: string;

	@ApiProperty({ type: String })
	transactionHash: Hash;

	@ApiProperty({ type: 'integer' })
	blockNumber: number;

	@ApiProperty(DATE_PROPERTY)
	paidAt: Date;

	@ApiProperty({
		type: HostPayoutClaimDto,
		isArray: true,
		description:
			'Claims credited to the host key since its previous payout, oldest first',
	})
	claims: HostPayoutClaimDto[];
}

@ApiSchema({ name: 'HostPayoutPage' })
export class HostPayoutPageDto extends CursorPageDto<HostPayoutDto> {
	@ApiProperty({ type: HostPayoutDto, isArray: true })
	declare items: HostPayoutDto[];
}

export class ListHostPayoutsQueryDto extends CursorPageQueryDto {
	@PageLimit(HOST_PAYOUT_QUERY.defaultLimit, HOST_PAYOUT_QUERY.maximumLimit)
	override limit = HOST_PAYOUT_QUERY.defaultLimit;

	@ApiPropertyOptional({
		format: 'uuid',
		description: "Only payouts of this machine's host keys",
	})
	@IsOptional()
	@IsUUID()
	machineId?: string;

	@ApiPropertyOptional({
		...DATE_PROPERTY,
		description: 'Only payouts at or after this time',
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	from?: Date;

	@ApiPropertyOptional({
		...DATE_PROPERTY,
		description: 'Only payouts at or before this time',
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	to?: Date;
}
