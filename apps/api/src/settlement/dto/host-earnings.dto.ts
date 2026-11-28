/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { Address } from 'viem';
import {
	EVM_ADDRESS_API_PROPERTY,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';

const AMOUNT_PROPERTY = UINT_STRING_API_PROPERTY;

const NULLABLE_AMOUNT_PROPERTY = {
	...UINT_STRING_API_PROPERTY,
	nullable: true,
} as const;

const NULLABLE_DATE = {
	type: String,
	format: 'date-time',
	nullable: true,
} as const;

@ApiSchema({ name: 'HostMachineEarnings' })
export class HostMachineEarningsDto {
	@ApiProperty({ format: 'uuid' })
	machineId: string;

	@ApiProperty()
	machineName: string;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description:
			'The host key, the on-chain host of the payment channels it earned on',
	})
	hostAddress: Address;

	@ApiProperty({
		description:
			'False once the machine enrolled a newer host key; a retired key keeps what it was credited until the machine settles it',
	})
	current: boolean;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		nullable: true,
		description:
			"The key's default payout address as indexed from the escrow; null pays the key itself. Settlements relayed for the machine name the payout wallet in the key's signature instead",
	})
	payoutAddress: Address | null;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			"What the key's signed vouchers still owe it beyond what was claimed, after the fee, in micro-USD",
	})
	unclaimedMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description: 'Earnings claims credited and not withdrawn yet, in micro-USD',
	})
	creditedMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description: 'Earnings withdrawn so far, in micro-USD',
	})
	withdrawnMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description: 'Value frozen while the key was blocked, in micro-USD',
	})
	frozenMicroUsd: string;

	@ApiProperty(NULLABLE_DATE)
	blockedAt: Date | null;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			'Unclaimed plus credited: everything the next payout withdraws before its relay fee, in micro-USD',
	})
	pendingMicroUsd: string;

	@ApiProperty({
		...NULLABLE_AMOUNT_PROPERTY,
		description:
			"The relay fee the machine's next payout would pay at the chain's live gas price plus the relay fee margin, in micro-USD; null while the chain cannot be priced",
	})
	relayFeeMicroUsd: string | null;

	@ApiProperty({
		...NULLABLE_AMOUNT_PROPERTY,
		description:
			'What the next payout would bring the payout wallet: pending minus the relay fee, never below zero, in micro-USD; null while the chain cannot be priced',
	})
	netPayoutMicroUsd: string | null;

	@ApiProperty({
		...NULLABLE_AMOUNT_PROPERTY,
		description:
			'Pending earnings from which the machine is paid out: the payout minimum plus the relay fee, in micro-USD; null while the chain cannot be priced',
	})
	payoutThresholdMicroUsd: string | null;

	@ApiProperty({
		description:
			'True when the machine settles on its next check: the net payout reached the payout minimum, or the machine drains or a signer cap holds its vouchers and the payout still exceeds its fee',
	})
	payoutDue: boolean;

	@ApiProperty({
		...NULLABLE_DATE,
		description:
			"When the machine's next payout is expected: its next settlement check while the payout is due; null while it is not",
	})
	nextPayoutAt: Date | null;

	@ApiProperty({
		...NULLABLE_DATE,
		description:
			"The earliest deadline among the key's unclaimed vouchers: a paying customer's withdrawal unlocking or a signing key expiring or ending its thaw. Snapflow claims them into the credited balance at its own gas before it, so they are never lost to a fee",
	})
	claimDeadlineAt: Date | null;
}

@ApiSchema({ name: 'HostEscrowBalance' })
export class HostEscrowBalanceDto {
	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		nullable: true,
		description:
			'The linked payout wallet, which host settlements pay earnings into',
	})
	payoutWalletAddress: Address | null;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			'Signed and not claimed yet across all machines, after the fee, in micro-USD',
	})
	unclaimedMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			'Credited and not withdrawn yet across all machines, in micro-USD',
	})
	creditedMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description: 'Withdrawn so far across all machines, in micro-USD',
	})
	withdrawnMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description: 'Frozen across all machines, in micro-USD',
	})
	frozenMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			'Unclaimed plus credited across all machines, not paid out yet, in micro-USD',
	})
	pendingMicroUsd: string;

	@ApiProperty({
		...AMOUNT_PROPERTY,
		description:
			'What a payout must bring after its relay fee, micro-USD, before a machine settles; smaller earnings carry over',
	})
	payoutMinimumMicroUsd: string;

	@ApiProperty({
		...NULLABLE_AMOUNT_PROPERTY,
		description:
			"The relay fee of a payout that withdraws credited earnings without claims, at the chain's live gas price plus the relay fee margin, in micro-USD; each claimed channel adds a little. Null while the chain cannot be priced",
	})
	relayFeeMicroUsd: string | null;

	@ApiProperty({
		description:
			'How long before a claim deadline Snapflow claims the unclaimed value into the credited balance at its own gas, in seconds',
	})
	claimDeadlineNoticeSeconds: number;

	@ApiProperty({
		...NULLABLE_DATE,
		description:
			'The soonest expected payout over all machines; null while no machine is due',
	})
	nextPayoutAt: Date | null;

	@ApiProperty({ type: HostMachineEarningsDto, isArray: true })
	machines: HostMachineEarningsDto[];
}
