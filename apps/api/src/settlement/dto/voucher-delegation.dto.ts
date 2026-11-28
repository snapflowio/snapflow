/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { refillSignerBudget, signerBudgetCapacity } from '@snapflow/contracts';
import type { Address, Hex } from 'viem';
import {
	EVM_ADDRESS_API_PROPERTY,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import type { EscrowSigner } from '../entities/escrow-signer.entity';
import { EscrowSignerStatus } from '../enums/escrow-signer-status.enum';
import { escrowSignerStatus } from '../utils/delegated-signer/delegated-signer.util';
import { microUsd, secondsUntil } from '../utils/escrow/escrow-amount.util';
import { chainTimestamp } from '../utils/escrow/escrow-event-record.util';
import {
	signerBudgetOf,
	storedSignerBudget,
} from '../utils/escrow/signer-budget.util';
import { EscrowWindowsDto } from './escrow.dto';

const NULLABLE_DATE = {
	type: String,
	format: 'date-time',
	nullable: true,
} as const;

const HOURLY_CAP_PROPERTY = {
	...UINT_STRING_API_PROPERTY,
	description:
		'uint96, micro-USD per hour the key may authorize; its bucket holds at most SIGNER_BURST_HOURS (24) hours of it',
} as const;

const EXPIRY_PROPERTY = {
	...UINT_STRING_API_PROPERTY,
	description: 'uint64, unix seconds',
} as const;

@ApiSchema({ name: 'SignerScope' })
export class SignerScopeDto {
	@ApiProperty(HOURLY_CAP_PROPERTY)
	hourlyCap: string;

	@ApiProperty(EXPIRY_PROPERTY)
	expiry: string;

	@ApiProperty({
		type: 'integer',
		description:
			'uint16; the highest voucher fee, in basis points of each claim, the customer consents to',
	})
	maxFeeBps: number;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The only host the key may sign for; zero allows any host',
	})
	host: Address;
}

@ApiSchema({ name: 'EscrowSignerGrant' })
export class EscrowSignerGrantDto {
	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	signerAddress: Address;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Micro-USD per hour the bucket refills at',
	})
	hourlyCap: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'Micro-USD the key may still authorize now: the bucket level, which starts empty at the grant',
	})
	available: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Micro-USD the bucket holds at most at the current rate',
	})
	capacity: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		nullable: true,
		description:
			'The lower hourly cap lowerSignerLimit scheduled, micro-USD; null when none is pending',
	})
	pendingHourlyCap: string | null;

	@ApiProperty({
		...NULLABLE_DATE,
		description:
			'When the pending lower hourly cap takes effect, on the escrow unfrozen clock',
	})
	pendingEffectiveAt: Date | null;

	@ApiProperty({ type: String, format: 'date-time' })
	expiresAt: Date;

	@ApiProperty({ type: 'integer' })
	maxFeeBps: number;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		nullable: true,
		description: 'The only host the key may sign for; null for any host',
	})
	hostAddress: Address | null;

	@ApiProperty({
		...NULLABLE_DATE,
		description:
			'When the thaw ends and the key may be revoked; Snapflow stops signing with a thawing key',
	})
	thawEndsAt: Date | null;

	@ApiProperty({
		type: 'integer',
		nullable: true,
		description:
			'Seconds until the thaw ends and the key may be revoked, on the escrow unfrozen clock; 0 once it ended, null when not thawing',
	})
	thawEndsInSeconds: number | null;

	@ApiProperty(NULLABLE_DATE)
	revokedAt: Date | null;

	@ApiProperty({
		enum: EscrowSignerStatus,
		enumName: 'EscrowSignerStatus',
		description:
			"Where the grant stands now on the escrow's clocks: active until it expires, thawing, revocable once the thaw ended, revoked or expired",
	})
	status: EscrowSignerStatus;

	static from(
		grant: EscrowSigner,
		unfrozenNow: bigint,
		chainNow: Date
	): EscrowSignerGrantDto {
		const budget = storedSignerBudget(
			refillSignerBudget(signerBudgetOf(grant), unfrozenNow)
		);
		const pending = budget.pendingEffectiveAt !== null;
		return {
			signerAddress: grant.signerAddress,
			hourlyCap: budget.hourlyCap,
			available: budget.available,
			capacity: signerBudgetCapacity(microUsd(budget.hourlyCap)).toString(),
			pendingHourlyCap: pending ? budget.pendingHourlyCap : null,
			pendingEffectiveAt: budget.pendingEffectiveAt,
			expiresAt: grant.expiresAt,
			maxFeeBps: grant.maxFeeBps,
			hostAddress: grant.hostAddress,
			thawEndsAt: grant.thawEndsAt,
			thawEndsInSeconds: secondsUntil(grant.thawEndsAt, unfrozenNow),
			revokedAt: grant.revokedAt,
			status: escrowSignerStatus(grant, chainTimestamp(unfrozenNow), chainNow),
		};
	}
}

@ApiSchema({ name: 'VoucherDelegation' })
export class VoucherDelegationDto {
	@ApiProperty({ type: 'integer', description: 'EIP-155 chain id' })
	chainId: number;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	escrowAddress: Address;

	@ApiProperty({ ...EVM_ADDRESS_API_PROPERTY, nullable: true })
	fundingWalletAddress: Address | null;

	@ApiProperty({ type: EscrowWindowsDto })
	windows: EscrowWindowsDto;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		nullable: true,
		description: "The funding wallet's delegated signer, once created",
	})
	delegatedSignerAddress: Address | null;

	@ApiProperty({
		type: EscrowSignerGrantDto,
		nullable: true,
		description:
			'The delegated signer as the escrow authorized it; null until authorizeSigner is indexed',
	})
	delegatedSigner: EscrowSignerGrantDto | null;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'What the running sandboxes cost per hour now, micro-USD; the suggested hourly cap adds headroom to it',
	})
	hourlySpendMicroUsd: string;

	@ApiProperty({
		type: SignerScopeDto,
		description:
			'A scope that covers the running sandboxes with room to grow, consenting to the marketplace fee for any host',
	})
	suggestedSignerScope: SignerScopeDto;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			"The chain's clock when this was served, unix seconds: what a signer scope's expiry counts from, since authorizeSigner checks it against block time",
	})
	chainNowSeconds: string;
}

@ApiSchema({ name: 'DelegatedSignerAuthorization' })
export class DelegatedSignerAuthorizationDto {
	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	signerAddress: Address;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'uint256, unix seconds',
	})
	proofDeadline: string;

	@ApiProperty({
		type: String,
		description:
			"The signer key's EIP-191 consent to sign for the funding wallet until the deadline",
	})
	proof: Hex;

	@ApiProperty({ type: SignerScopeDto })
	suggestedScope: SignerScopeDto;
}
