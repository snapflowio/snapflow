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
import type { EscrowSessionKey } from '../entities/escrow-session-key.entity';

const ADDRESS_PROPERTY = {
	type: String,
	description: 'EIP-55 checksummed address',
} as const;

@ApiSchema({ name: 'DelegatedSessionKey' })
export class DelegatedSessionKeyDto {
	@ApiProperty({ description: 'Total cap, in micro-USD' })
	spendCapMicroUsd: string;

	@ApiProperty({ description: 'Cap per started hour, in micro-USD' })
	hourlyCapMicroUsd: string;

	@ApiProperty({ type: String, format: 'date-time' })
	activatedAt: Date;

	@ApiProperty({ type: String, format: 'date-time' })
	expiresAt: Date;

	static from(key: EscrowSessionKey): DelegatedSessionKeyDto {
		return {
			spendCapMicroUsd: key.spendCapMicroUsd,
			hourlyCapMicroUsd: key.hourlyCapMicroUsd,
			activatedAt: key.activatedAt,
			expiresAt: key.expiresAt,
		};
	}
}

// What the dashboard needs to call setSessionKey(signerAddress,
// suggestedSpendCap, suggestedHourlyCap, suggestedExpiry) from the funding
// wallet.
@ApiSchema({ name: 'VoucherDelegation' })
export class VoucherDelegationDto {
	@ApiProperty({ type: 'integer', description: 'EIP-155 chain id' })
	chainId: number;

	@ApiProperty(ADDRESS_PROPERTY)
	escrowAddress: Address;

	@ApiProperty({
		...ADDRESS_PROPERTY,
		description: "Snapflow's delegated voucher signer",
	})
	signerAddress: Address;

	@ApiProperty({ ...ADDRESS_PROPERTY, nullable: true })
	fundingWalletAddress: Address | null;

	@ApiProperty({
		type: DelegatedSessionKeyDto,
		nullable: true,
		description: 'The active session key the funding wallet granted the signer',
	})
	sessionKey: DelegatedSessionKeyDto | null;

	@ApiProperty({
		description:
			'Hourly cap that covers the running sandboxes, in micro-USD (uint128)',
	})
	suggestedHourlyCapMicroUsd: string;

	@ApiProperty({
		description:
			'Total cap that covers the running sandboxes for the suggested expiry, in micro-USD (uint128)',
	})
	suggestedSpendCapMicroUsd: string;

	@ApiProperty({
		type: String,
		pattern: '^\\d+$',
		description: 'Suggested key expiry, in unix seconds (uint64)',
	})
	suggestedExpiry: string;
}
