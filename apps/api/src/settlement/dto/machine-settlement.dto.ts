/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import {
	EVM_ADDRESS_API_PROPERTY,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import { VoucherLimit } from '../enums/voucher-limit.enum';
import { VoucherSigningMode } from '../enums/voucher-signing-mode.enum';
import { EscrowWindowsDto } from './escrow.dto';
import { EscrowDomainDto } from './escrow-domain.dto';
import { HostSettlementDto } from './host-settlement.dto';
import { VoucherMessageDto } from './payment-voucher.dto';

const NULLABLE_DATE = {
	type: String,
	format: 'date-time',
	nullable: true,
} as const;

const NULLABLE_ADDRESS = {
	...EVM_ADDRESS_API_PROPERTY,
	nullable: true,
} as const;

@ApiSchema({ name: 'MachineSignedVoucher' })
export class MachineSignedVoucherDto extends VoucherMessageDto {
	@ApiProperty({ type: 'integer' })
	sequence: number;

	@ApiProperty({ type: String, description: 'EIP-712 digest' })
	digest: Hex;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The key that signed; claims name it as the signer',
	})
	signer: Address;

	@ApiProperty({ type: String })
	signature: Hex;
}

@ApiSchema({ name: 'MachineVoucherSigner' })
export class MachineVoucherSignerDto {
	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	signerAddress: Address;

	@ApiProperty({
		description:
			"True when the customer's own wallet signs, which no expiry, thaw or cap limits",
	})
	customerWallet: boolean;

	@ApiProperty({
		...NULLABLE_DATE,
		description:
			"When the key expires; vouchers it signed stay claimable for the escrow's claim window after it",
	})
	expiresAt: Date | null;

	@ApiProperty({
		...NULLABLE_DATE,
		description:
			"When the key's thaw ends; vouchers it signed must be claimed before then",
	})
	thawEndsAt: Date | null;

	@ApiProperty(NULLABLE_DATE)
	revokedAt: Date | null;
}

@ApiSchema({ name: 'MachineChannelSandbox' })
export class MachineChannelSandboxDto {
	@ApiProperty()
	sandboxId: string;

	@ApiProperty({ format: 'uuid' })
	placementPriceId: string;

	@ApiProperty(NULLABLE_DATE)
	endedAt: Date | null;
}

@ApiSchema({ name: 'MachineSettlementChannel' })
export class MachineSettlementChannelDto {
	@ApiProperty({ format: 'uuid' })
	paymentChannelId: string;

	@ApiProperty({
		type: String,
		description:
			'The escrow channel id: keccak256(chainId, escrow, customer, host, feeReceiver, feeBps, salt)',
	})
	channelId: Hex;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	customerAddress: Address;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: "The machine's host key the channel pays",
	})
	hostAddress: Address;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	feeReceiverAddress: Address;

	@ApiProperty({ type: 'integer' })
	feeBps: number;

	@ApiProperty({ type: String })
	salt: Hex;

	@ApiProperty({ enum: VoucherSigningMode, enumName: 'VoucherSigningMode' })
	signingMode: VoucherSigningMode;

	@ApiProperty({
		type: MachineChannelSandboxDto,
		isArray: true,
		description:
			'The sandboxes the channel pays for whose charges are still being metered',
	})
	sandboxes: MachineChannelSandboxDto[];

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'What the channel was charged so far, micro-USD',
	})
	chargedAmount: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: "The channel's claimed total, as indexed",
	})
	claimedAmount: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
		description:
			'Until when a signed voucher covered everything the channel was charged; once it falls more than voucherGraceIntervals behind, the sandboxes are unpaid',
	})
	coveredAt: Date;

	@ApiProperty({
		enum: VoucherLimit,
		enumName: 'VoucherLimit',
		nullable: true,
		description:
			"What held the latest voucher below the charges: the customer's balance or signer ran short",
	})
	voucherLimit: VoucherLimit | null;

	@ApiProperty({
		type: MachineSignedVoucherDto,
		nullable: true,
		description: 'Latest signed voucher, none before the first one is signed',
	})
	voucher: MachineSignedVoucherDto | null;

	@ApiProperty({ type: MachineVoucherSignerDto, nullable: true })
	signer: MachineVoucherSignerDto | null;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'What the customer requested to withdraw; claims still draw on it until it unlocks',
	})
	customerPendingAmount: string;

	@ApiProperty({
		...NULLABLE_DATE,
		description:
			"When the customer's pending withdrawal unlocks, on the escrow's unfrozen clock; Snapflow claims the channel before then",
	})
	customerWithdrawalUnlockAt: Date | null;
}

@ApiSchema({ name: 'MachineRelayFeeQuote' })
export class MachineRelayFeeQuoteDto {
	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Relay fee of a settlement before any claim, micro-USD',
	})
	baseMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'What each claim of the batch adds, micro-USD',
	})
	perClaimMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'The most a relay fee may be (MAX_RELAY_FEE)',
	})
	maximumMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			"The host key's hostWithdrawalNonceOf, which its next HostWithdrawal commits to",
	})
	hostWithdrawalNonce: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
		description:
			"The settlement chain's clock (block time) when the quote was made; a HostWithdrawal deadline counts its lifetime from it",
	})
	quotedAt: Date;
}

@ApiSchema({ name: 'MachineSettlementRelayer' })
export class MachineSettlementRelayerDto {
	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description:
			"Snapflow's relayer: the relayer a HostWithdrawal sent through the settle endpoint names",
	})
	address: Address;

	@ApiProperty({
		type: 'integer',
		description: 'Most claims one settlement may carry (MAX_BATCH_SIZE)',
	})
	maxBatchSize: number;

	@ApiProperty({
		type: 'integer',
		description: 'Seconds ahead of now the HostWithdrawal deadline should lie',
	})
	signatureLifetimeSeconds: number;

	@ApiProperty({
		type: MachineRelayFeeQuoteDto,
		nullable: true,
		description:
			"The current relay fee quote, priced from the chain's live gas plus the relay fee margin: base + perClaim * claims, at most maximum; null while the chain is unreachable",
	})
	quote: MachineRelayFeeQuoteDto | null;
}

@ApiSchema({ name: 'MachineSettlementDocument' })
export class MachineSettlementDocumentDto {
	@ApiProperty({
		type: 'integer',
		description: 'Version of this document shape',
	})
	schemaVersion: number;

	@ApiProperty()
	digest: string;

	@ApiProperty({ type: EscrowDomainDto })
	domain: EscrowDomainDto;

	@ApiProperty({ type: EscrowWindowsDto })
	windows: EscrowWindowsDto;

	@ApiProperty({ type: 'integer' })
	voucherIntervalSeconds: number;

	@ApiProperty({ type: 'integer' })
	voucherGraceIntervals: number;

	@ApiProperty({
		...NULLABLE_ADDRESS,
		description: "The machine's current host key, null before it enrolled one",
	})
	hostAddress: Address | null;

	@ApiProperty({
		...NULLABLE_ADDRESS,
		description:
			"The organization's payout wallet: the payout a HostWithdrawal must name",
	})
	payoutAddress: Address | null;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'What a payout must bring the host after its relay fee, micro-USD, before the agent settles; smaller earnings carry over, and Snapflow claims any that near a deadline into the credited balance at its own gas',
	})
	payoutMinimumMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			"The host key's escrow balance from earlier claims, as indexed: a settlement withdraws it together with what it claims, micro-USD",
	})
	creditedAmount: string;

	@ApiProperty({ type: MachineSettlementRelayerDto })
	relayer: MachineSettlementRelayerDto;

	@ApiProperty({
		type: HostSettlementDto,
		nullable: true,
		description: "The host key's latest settlement",
	})
	latestSettlement: HostSettlementDto | null;

	@ApiProperty({ type: MachineSettlementChannelDto, isArray: true })
	channels: MachineSettlementChannelDto[];
}
