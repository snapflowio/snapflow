/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { Address, Hash } from 'viem';
import { PageLimit } from '../../common/decorators/page-limit.decorator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import {
	ESCROW_EVENT_KINDS,
	ESCROW_EVENT_QUERY,
} from '../constants/escrow.constants';
import type { EscrowEvent } from '../entities/escrow-event.entity';
import { EscrowEventParty } from '../enums/escrow-event-party.enum';
import type { EscrowEventKind, StoredEscrowArgs } from '../types/escrow.types';

const ADDRESS_PROPERTY = {
	type: String,
	description: 'EIP-55 checksummed address',
} as const;

@ApiSchema({ name: 'EscrowAccount' })
export class EscrowAccountDto {
	@ApiProperty({ type: 'integer', description: 'EIP-155 chain id' })
	chainId: number;

	@ApiProperty(ADDRESS_PROPERTY)
	escrowAddress: Address;

	@ApiProperty(ADDRESS_PROPERTY)
	usdcAddress: Address;

	@ApiProperty({
		...ADDRESS_PROPERTY,
		nullable: true,
		description: 'Linked funding wallet, if any',
	})
	fundingWalletAddress: Address | null;

	@ApiProperty({
		description:
			'USDC the escrow holds for the funding wallet, in micro-USD, as of the indexed block',
	})
	balanceMicroUsd: string;

	@ApiProperty({
		description:
			'Requested withdrawal still in its dispute window, in micro-USD',
	})
	pendingWithdrawalMicroUsd: string;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	withdrawalReadyAt: Date | null;

	@ApiProperty({ description: 'The escrow froze the funding wallet' })
	blocked: boolean;

	@ApiProperty({
		type: 'integer',
		nullable: true,
		description: 'Last chain block whose escrow events are indexed',
	})
	indexedThroughBlock: number | null;
}

@ApiSchema({ name: 'EscrowEvent' })
export class EscrowEventDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ enum: ESCROW_EVENT_KINDS, enumName: 'EscrowEventKind' })
	kind: EscrowEventKind;

	@ApiProperty({
		enum: EscrowEventParty,
		enumName: 'EscrowEventParty',
		isArray: true,
		description: 'The roles the organization played in the event',
	})
	parties: EscrowEventParty[];

	@ApiProperty({ type: 'integer' })
	blockNumber: number;

	@ApiProperty({ type: String, format: 'date-time' })
	blockTimestamp: Date;

	@ApiProperty({ type: String })
	transactionHash: Hash;

	@ApiProperty({ type: 'integer' })
	logIndex: number;

	@ApiProperty({
		type: 'object',
		additionalProperties: { type: 'string' },
		description:
			'Decoded event arguments; integers (USDC amounts in micro-USD, unix seconds) are decimal strings',
	})
	args: StoredEscrowArgs;

	static from(event: EscrowEvent, organizationId: string): EscrowEventDto {
		return {
			id: event.id,
			kind: event.kind,
			parties: [
				...(event.customerOrganizationId === organizationId
					? [EscrowEventParty.CUSTOMER]
					: []),
				...(event.hostOrganizationId === organizationId
					? [EscrowEventParty.HOST]
					: []),
			],
			blockNumber: event.blockNumber,
			blockTimestamp: event.blockTimestamp,
			transactionHash: event.transactionHash,
			logIndex: event.logIndex,
			args: event.args,
		};
	}
}

@ApiSchema({ name: 'EscrowEventPage' })
export class EscrowEventPageDto extends CursorPageDto<EscrowEventDto> {
	@ApiProperty({ type: EscrowEventDto, isArray: true })
	declare items: EscrowEventDto[];
}

export class ListEscrowEventsQueryDto extends CursorPageQueryDto {
	@PageLimit(ESCROW_EVENT_QUERY.defaultLimit, ESCROW_EVENT_QUERY.maximumLimit)
	override limit = ESCROW_EVENT_QUERY.defaultLimit;
}
