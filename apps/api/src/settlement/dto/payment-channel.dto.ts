/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { EscrowDomain } from '@snapflow/contracts';
import type { Address, Hex } from 'viem';
import { PageLimit } from '../../common/decorators/page-limit.decorator';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import { PAYMENT_CHANNEL_QUERY } from '../constants/payment-channel.constants';
import {
	EVM_ADDRESS_API_PROPERTY,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import type { PaymentChannel } from '../entities/payment-channel.entity';
import type { PaymentChannelCharge } from '../entities/payment-channel-charge.entity';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import { PaymentChannelKind } from '../enums/payment-channel-kind.enum';
import { VoucherLimit } from '../enums/voucher-limit.enum';
import { VoucherSigningMode } from '../enums/voucher-signing-mode.enum';
import type { ChannelVoucher } from '../types/payment-channel.types';
import { refundDue } from '../utils/channels/channel-charge.util';
import { EscrowDomainDto } from './escrow-domain.dto';
import { PaymentVoucherDto } from './payment-voucher.dto';
import { SettlementPartyPageQueryDto } from './settlement-party-query.dto';

const NULLABLE_DATE = {
	type: String,
	format: 'date-time',
	nullable: true,
} as const;

@ApiSchema({ name: 'PaymentChannelCharge' })
export class PaymentChannelChargeDto {
	@ApiProperty({ format: 'uuid' })
	placementPriceId: string;

	@ApiProperty()
	sandboxId: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'What the placement price was charged so far, micro-USD',
	})
	chargedMicroUsd: string;

	@ApiProperty(NULLABLE_DATE)
	endedAt: Date | null;

	static from(charge: PaymentChannelCharge): PaymentChannelChargeDto {
		return {
			placementPriceId: charge.placementPriceId,
			sandboxId: charge.sandboxId,
			chargedMicroUsd: charge.chargedMicroUsd,
			endedAt: charge.endedAt,
		};
	}
}

@ApiSchema({ name: 'PaymentChannel' })
export class PaymentChannelDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ enum: PaymentChannelKind, enumName: 'PaymentChannelKind' })
	kind: PaymentChannelKind;

	@ApiProperty({
		type: String,
		description:
			'The escrow channel id: keccak256(chainId, escrow, customer, host, feeReceiver, feeBps, salt)',
	})
	channelId: Hex;

	@ApiProperty({ enum: VoucherSigningMode, enumName: 'VoucherSigningMode' })
	signingMode: VoucherSigningMode;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'Paying funding wallet',
	})
	customerAddress: Address;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description:
			"Paid host: the machine's host key, or Snapflow's platform receiver for a platform channel",
	})
	hostAddress: Address;

	@ApiProperty(EVM_ADDRESS_API_PROPERTY)
	feeReceiverAddress: Address;

	@ApiProperty({
		type: 'integer',
		description: 'Fee share of every claim, in basis points',
	})
	feeBps: number;

	@ApiProperty({ type: String })
	salt: Hex;

	@ApiProperty({
		type: String,
		format: 'uuid',
		nullable: true,
		description: 'The paid machine; null for a platform channel',
	})
	machineId: string | null;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'What the channel was charged so far, micro-USD; never less than the latest signed voucher, which binds the customer',
	})
	chargedMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			"What credits granted after a voucher was signed took off charges it already bound the customer to pay, micro-USD, less what was already refunded; the channel's later charges absorb it and what is left is refunded by hand from the fee wallet",
	})
	refundDueMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'What was refunded by hand from the fee wallet so far, micro-USD',
	})
	refundedMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Cumulative amount of the latest voucher, micro-USD',
	})
	issuedMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Cumulative amount of the latest signed voucher, micro-USD',
	})
	signedMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'Claimed so far, micro-USD, as indexed',
	})
	claimedMicroUsd: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
		description:
			'Until when a signed voucher covered everything the channel was charged',
	})
	coveredAt: Date;

	@ApiProperty({
		enum: VoucherLimit,
		enumName: 'VoucherLimit',
		nullable: true,
		description: 'What held the latest voucher below the charges',
	})
	voucherError: VoucherLimit | null;

	@ApiProperty(NULLABLE_DATE)
	lastClaimedAt: Date | null;

	@ApiProperty({
		type: PaymentChannelChargeDto,
		isArray: true,
		description:
			'The placement prices of the channel whose charges are still being metered',
	})
	charges: PaymentChannelChargeDto[];

	@ApiProperty({ type: PaymentVoucherDto, nullable: true })
	latestVoucher: PaymentVoucherDto | null;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: Date;

	static from(
		channel: PaymentChannel,
		charges: readonly PaymentChannelCharge[],
		latest: PaymentVoucher | undefined
	): PaymentChannelDto {
		return {
			id: channel.id,
			kind: channel.kind,
			channelId: channel.channelId,
			signingMode: channel.signingMode,
			customerAddress: channel.customerAddress,
			hostAddress: channel.hostAddress,
			feeReceiverAddress: channel.feeReceiverAddress,
			feeBps: channel.feeBps,
			salt: channel.salt,
			machineId: channel.machineId,
			chargedMicroUsd: channel.chargedMicroUsd,
			refundDueMicroUsd: refundDue(channel, charges).toString(),
			refundedMicroUsd: channel.refundedMicroUsd,
			issuedMicroUsd: channel.issuedMicroUsd,
			signedMicroUsd: channel.signedMicroUsd,
			claimedMicroUsd: channel.claimedMicroUsd,
			coveredAt: channel.coveredAt,
			voucherError: channel.voucherError,
			lastClaimedAt: channel.lastClaimedAt,
			charges: charges
				.filter(({ settledAt }) => settledAt === null)
				.map((charge) => PaymentChannelChargeDto.from(charge)),
			latestVoucher: latest ? PaymentVoucherDto.from(channel, latest) : null,
			createdAt: channel.createdAt,
		};
	}
}

@ApiSchema({ name: 'PaymentChannelPage' })
export class PaymentChannelPageDto extends CursorPageDto<PaymentChannelDto> {
	@ApiProperty({ type: PaymentChannelDto, isArray: true })
	declare items: PaymentChannelDto[];
}

export class ListPaymentChannelsQueryDto extends SettlementPartyPageQueryDto {
	@PageLimit(
		PAYMENT_CHANNEL_QUERY.defaultLimit,
		PAYMENT_CHANNEL_QUERY.maximumLimit
	)
	override limit = PAYMENT_CHANNEL_QUERY.defaultLimit;
}

@ApiSchema({ name: 'PendingVoucher' })
class PendingVoucherDto {
	@ApiProperty({ format: 'uuid' })
	paymentChannelId: string;

	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	machineId: string | null;

	@ApiProperty({ type: PaymentVoucherDto })
	voucher: PaymentVoucherDto;

	static from({ channel, voucher }: ChannelVoucher): PendingVoucherDto {
		return {
			paymentChannelId: channel.id,
			machineId: channel.machineId,
			voucher: PaymentVoucherDto.from(channel, voucher),
		};
	}
}

@ApiSchema({ name: 'PendingVouchers' })
export class PendingVouchersDto {
	@ApiProperty({
		type: EscrowDomainDto,
		description: 'EIP-712 domain every voucher is signed under',
	})
	domain: EscrowDomainDto;

	@ApiProperty({ type: PendingVoucherDto, isArray: true })
	vouchers: PendingVoucherDto[];

	static from(
		domain: EscrowDomain,
		pending: readonly ChannelVoucher[]
	): PendingVouchersDto {
		return {
			domain: EscrowDomainDto.from(domain),
			vouchers: pending.map((entry) => PendingVoucherDto.from(entry)),
		};
	}
}
