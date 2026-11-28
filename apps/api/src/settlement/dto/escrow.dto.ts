/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional } from 'class-validator';
import type { Address, Hash } from 'viem';
import { PageLimit } from '../../common/decorators/page-limit.decorator';
import { ToArray } from '../../common/decorators/to-array.decorator';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import {
	ESCROW_EVENT_KINDS,
	ESCROW_EVENT_QUERY,
} from '../constants/escrow.constants';
import {
	EVM_ADDRESS_API_PROPERTY,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import type { EscrowEvent } from '../entities/escrow-event.entity';
import { SettlementParty } from '../enums/settlement-party.enum';
import type { EscrowPolicy } from '../services/escrow/escrow-policy.service';
import type { EscrowEventKind, StoredEscrowArgs } from '../types/escrow.types';
import { partiesOf } from '../utils/settlement-party.util';
import { SettlementPartyPageQueryDto } from './settlement-party-query.dto';

const AMOUNT_PROPERTY = UINT_STRING_API_PROPERTY;

@ApiSchema({ name: 'EscrowWindows' })
export class EscrowWindowsDto {
	@ApiProperty({
		type: 'integer',
		description:
			'Seconds a requested withdrawal stays claimable by hosts before it can be completed, on the unfrozen clock',
	})
	withdrawalDelaySeconds: number;

	@ApiProperty({
		type: 'integer',
		description:
			'Seconds vouchers a signer key stamped before its expiry stay claimable after it',
	})
	claimWindowSeconds: number;

	@ApiProperty({
		type: 'integer',
		description:
			'Seconds a thawing signer stays valid before it can be revoked',
	})
	signerThawSeconds: number;

	static from(policy: EscrowPolicy): EscrowWindowsDto {
		return { ...policy };
	}
}

@ApiSchema({ name: 'EscrowAccount' })
export class EscrowAccountDto {
	@ApiProperty({ type: 'integer', description: 'EIP-155 chain id' })
	chainId: number;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	escrowAddress: Address;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	usdcAddress: Address;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		nullable: true,
		description: 'Linked funding wallet, if any',
	})
	fundingWalletAddress: Address | null;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			'Free balance of the funding wallet, in micro-USD, as of the indexed block; a withdrawal of it is requested first',
	})
	freeMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			'Requested for withdrawal and not paid out yet, in micro-USD; hosts can still claim it until it unlocks',
	})
	pendingMicroUsd: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description:
			'When the pending withdrawal can be completed, on the escrow unfrozen clock',
	})
	withdrawalUnlockAt: Date | null;

	@ApiProperty({
		type: 'integer',
		nullable: true,
		description:
			'Seconds until the pending withdrawal can be completed, on the escrow unfrozen clock; 0 once it can, null without a pending withdrawal',
	})
	withdrawalUnlocksInSeconds: number | null;

	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description:
			'Block time of the latest withdrawal request while one is pending; null without a pending withdrawal',
	})
	withdrawalRequestedAt: Date | null;

	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description:
			'Wall-clock estimate of when the pending withdrawal can be completed; null without a pending withdrawal, and while escrow claims are frozen or the funding wallet is blocked, since the unlock clock is paused then',
	})
	withdrawalAvailableAt: Date | null;

	@ApiProperty({
		description:
			'True when a withdrawal is pending and the funding wallet can cancel it, returning it to the free balance',
	})
	withdrawalCancellable: boolean;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			'What Snapflow issued from the funding wallet across all its payment channels that claims have not paid yet, in micro-USD',
	})
	outstandingMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			'Free less what is outstanding: what new usage and vouchers may still draw on, in micro-USD; a requested withdrawal stops counting at once',
	})
	availableMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			"What the organization's sandboxes and Snapflow storage cost an hour as they are now, in micro-USD",
	})
	burnMicroUsdPerHour: string;

	@ApiProperty({
		type: String,
		nullable: true,
		description:
			'Seconds the available balance lasts at the current burn, as a decimal string; null while nothing burns. Warnings go out at 24 hours and at 1 hour',
	})
	runwaySeconds: string | null;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description: 'Value frozen while the address was blocked, in micro-USD',
	})
	frozenMicroUsd: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description:
			'When the block in force on the funding wallet began; null when it is not blocked',
	})
	blockedAt: Date | null;

	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description:
			'When the block in force lapses by itself; null when the funding wallet is not blocked',
	})
	blockedUntil: Date | null;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		nullable: true,
		description:
			'Micro-USD the funding wallet can still deposit under the escrow deposit caps; null when deposits are uncapped',
	})
	depositRoomMicroUsd: string | null;

	@ApiProperty({ type: EscrowWindowsDto })
	windows: EscrowWindowsDto;

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
		enum: SettlementParty,
		enumName: 'SettlementParty',
		isArray: true,
		description: 'The roles the organization played in the event',
	})
	parties: SettlementParty[];

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
			parties: partiesOf(event, organizationId),
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

export class ListEscrowEventsQueryDto extends SettlementPartyPageQueryDto {
	@PageLimit(ESCROW_EVENT_QUERY.defaultLimit, ESCROW_EVENT_QUERY.maximumLimit)
	override limit = ESCROW_EVENT_QUERY.defaultLimit;

	@ApiPropertyOptional({
		enum: ESCROW_EVENT_KINDS,
		enumName: 'EscrowEventKind',
		isArray: true,
		description: 'Only events of these kinds',
	})
	@IsOptional()
	@ToArray()
	@IsArray()
	@IsIn(ESCROW_EVENT_KINDS, { each: true })
	kind?: EscrowEventKind[];
}
