/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { MAX_BATCH_SIZE } from '@snapflow/contracts';
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsEthereumAddress,
	Matches,
} from 'class-validator';
import type { Address, Hash, Hex } from 'viem';
import { MACHINE_HOST_SIGNATURE_PATTERN } from '../../machine/constants/machine-registration.constants';
import {
	EVM_ADDRESS_API_PROPERTY,
	EVM_HASH_PATTERN,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import type { HostSettlement } from '../entities/host-settlement.entity';
import { HostSettlementStatus } from '../enums/host-settlement-status.enum';

const UINT_PATTERN = new RegExp(UINT_STRING_API_PROPERTY.pattern);

const NULLABLE_DATE = {
	type: String,
	format: 'date-time',
	nullable: true,
} as const;

@ApiSchema({ name: 'HostSettlementItem' })
class HostSettlementItemDto {
	@ApiProperty({ format: 'uuid' })
	paymentChannelId: string;

	@ApiProperty({ format: 'uuid' })
	voucherId: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'The most the claim may pay, micro-USD',
	})
	maxAmountMicroUsd: string;
}

@ApiSchema({ name: 'HostSettlement' })
export class HostSettlementDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	hostAddress: Address;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	payoutAddress: Address;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'The relay fee the host signed, micro-USD',
	})
	relayFeeMicroUsd: string;

	@ApiProperty(UINT_STRING_API_PROPERTY)
	nonce: string;

	@ApiProperty({ type: String, format: 'date-time' })
	deadline: Date;

	@ApiProperty({ type: HostSettlementItemDto, isArray: true })
	items: HostSettlementItemDto[];

	@ApiProperty({ enum: HostSettlementStatus, enumName: 'HostSettlementStatus' })
	status: HostSettlementStatus;

	@ApiProperty({ type: String, nullable: true })
	transactionHash: Hash | null;

	@ApiProperty({ type: String, nullable: true })
	error: string | null;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: Date;

	@ApiProperty(NULLABLE_DATE)
	settledAt: Date | null;

	static from(settlement: HostSettlement): HostSettlementDto {
		return {
			id: settlement.id,
			hostAddress: settlement.hostAddress,
			payoutAddress: settlement.payoutAddress,
			relayFeeMicroUsd: settlement.relayFeeMicroUsd,
			nonce: settlement.nonce,
			deadline: settlement.deadline,
			items: settlement.items,
			status: settlement.status,
			transactionHash: settlement.transactionHash,
			error: settlement.error,
			createdAt: settlement.createdAt,
			settledAt: settlement.settledAt,
		};
	}
}

@ApiSchema({ name: 'SettleMachineChannels' })
export class SettleMachineChannelsDto {
	@ApiProperty({
		type: String,
		isArray: true,
		maxItems: MAX_BATCH_SIZE,
		pattern: EVM_HASH_PATTERN.source,
		description:
			'Escrow channel ids whose latest signed voucher to claim; empty to withdraw what is already credited',
	})
	@IsArray()
	@ArrayMaxSize(MAX_BATCH_SIZE)
	@ArrayUnique()
	@Matches(EVM_HASH_PATTERN, { each: true })
	channelIds: Hex[];

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The payout wallet from the settlement document',
	})
	@IsEthereumAddress()
	payoutAddress: Address;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'Relay fee in USDC base units, at least the quote for this many channels',
	})
	@Matches(UINT_PATTERN)
	relayFee: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: "The host key's hostWithdrawalNonceOf from the document",
	})
	@Matches(UINT_PATTERN)
	nonce: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Signature deadline in Unix seconds',
	})
	@Matches(UINT_PATTERN)
	deadline: string;

	@ApiProperty({
		type: String,
		description: "The host key's 65-byte EIP-712 HostWithdrawal signature",
		pattern: MACHINE_HOST_SIGNATURE_PATTERN.source,
	})
	@Matches(MACHINE_HOST_SIGNATURE_PATTERN)
	signature: Hex;
}
