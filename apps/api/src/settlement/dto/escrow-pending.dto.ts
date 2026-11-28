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
import {
	PENDING_WITHDRAWAL_CHANGE_KINDS,
	type PendingWithdrawalChangeKind,
} from '../constants/escrow.constants';
import {
	EVM_ADDRESS_API_PROPERTY,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import { PendingDepositKind } from '../enums/pending-deposit-kind.enum';
import { PendingDepositStage } from '../enums/pending-deposit-stage.enum';

const DATE_PROPERTY = { type: String, format: 'date-time' } as const;

@ApiSchema({ name: 'PendingEscrowDeposit' })
export class PendingEscrowDepositDto {
	@ApiProperty({
		enum: PendingDepositKind,
		enumName: 'PendingDepositKind',
		description:
			'escrow: a deposit into the escrow for the funding wallet; wallet: USDC arriving at the funding wallet itself, such as from an exchange',
	})
	kind: PendingDepositKind;

	@ApiProperty({
		enum: PendingDepositStage,
		enumName: 'PendingDepositStage',
		description:
			'confirming: on chain and not indexed yet; finalizing: indexed and held until the chain finalizes it',
	})
	stage: PendingDepositStage;

	@ApiProperty({ type: String })
	transactionHash: Hash;

	@ApiProperty({ type: 'integer' })
	logIndex: number;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The address the USDC came from',
	})
	payerAddress: Address;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Amount credited, in micro-USD',
	})
	amountMicroUsd: string;

	@ApiProperty({ type: 'integer' })
	blockNumber: number;

	@ApiProperty(DATE_PROPERTY)
	blockTimestamp: Date;

	@ApiProperty({
		type: 'integer',
		description: 'Blocks on top of the deposit, its own included',
	})
	confirmations: number;

	@ApiProperty({
		type: 'integer',
		description: 'Confirmations the stage waits for',
	})
	requiredConfirmations: number;
}

@ApiSchema({ name: 'PendingWithdrawalChange' })
export class PendingWithdrawalChangeDto {
	@ApiProperty({
		enum: PENDING_WITHDRAWAL_CHANGE_KINDS,
		enumName: 'PendingWithdrawalChangeKind',
	})
	kind: PendingWithdrawalChangeKind;

	@ApiProperty({ type: String })
	transactionHash: Hash;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Amount the change moves, in micro-USD',
	})
	amountMicroUsd: string;

	@ApiProperty({ type: 'integer' })
	blockNumber: number;

	@ApiProperty(DATE_PROPERTY)
	blockTimestamp: Date;
}

@ApiSchema({ name: 'EscrowPendingChanges' })
export class EscrowPendingChangesDto {
	@ApiProperty({ type: 'integer' })
	latestBlock: number;

	@ApiProperty({ type: 'integer' })
	safeBlock: number;

	@ApiProperty({
		type: 'integer',
		nullable: true,
		description: 'Last chain block whose escrow events are indexed',
	})
	indexedThroughBlock: number | null;

	@ApiProperty(DATE_PROPERTY)
	observedAt: Date;

	@ApiProperty({
		type: PendingEscrowDepositDto,
		isArray: true,
		description:
			'Deposits for the funding wallet not in its balance yet, newest first',
	})
	deposits: PendingEscrowDepositDto[];

	@ApiProperty({
		type: PendingWithdrawalChangeDto,
		isArray: true,
		description:
			'Withdrawal requests, cancellations and completions of the funding wallet on chain and not indexed yet, newest first',
	})
	withdrawalChanges: PendingWithdrawalChangeDto[];
}
