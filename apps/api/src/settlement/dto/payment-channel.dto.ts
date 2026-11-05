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
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import { PAYMENT_CHANNEL_QUERY } from '../constants/payment-channel.constants';
import type { PaymentChannel } from '../entities/payment-channel.entity';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import { PaymentChannelState } from '../enums/payment-channel-state.enum';
import { VoucherSigningMode } from '../enums/voucher-signing-mode.enum';
import { PaymentVoucherDto } from './payment-voucher.dto';

const ADDRESS_PROPERTY = {
	type: String,
	description: 'EIP-55 checksummed address',
} as const;

@ApiSchema({ name: 'EscrowDomain' })
export class EscrowDomainDto {
	@ApiProperty()
	name: string;

	@ApiProperty()
	version: string;

	@ApiProperty({ type: 'integer', description: 'EIP-155 chain id' })
	chainId: number;

	@ApiProperty(ADDRESS_PROPERTY)
	verifyingContract: Address;

	static from(domain: EscrowDomain): EscrowDomainDto {
		return { ...domain };
	}
}

@ApiSchema({ name: 'PaymentChannel' })
export class PaymentChannelDto {
	@ApiProperty({ type: String, description: 'The escrow channel id' })
	channelId: Hex;

	@ApiProperty({ format: 'uuid' })
	leaseId: string;

	@ApiProperty()
	sandboxId: string;

	@ApiProperty({ enum: VoucherSigningMode, enumName: 'VoucherSigningMode' })
	signingMode: VoucherSigningMode;

	@ApiProperty({ enum: PaymentChannelState, enumName: 'PaymentChannelState' })
	state: PaymentChannelState;

	@ApiProperty({ ...ADDRESS_PROPERTY, description: 'Paying funding wallet' })
	customerAddress: Address;

	@ApiProperty({ ...ADDRESS_PROPERTY, description: 'Paid payout wallet' })
	hostAddress: Address;

	@ApiProperty({ type: String, format: 'date-time' })
	openedAt: Date;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	closedAt: Date | null;

	@ApiProperty({
		type: String,
		format: 'date-time',
		description:
			'Until when a signed voucher covered everything the lease owed',
	})
	coveredAt: Date;

	@ApiProperty({
		type: String,
		nullable: true,
		description: 'Why the latest voucher could not be signed',
	})
	voucherError: string | null;

	@ApiProperty({
		type: 'integer',
		description: 'Highest voucher sequence Snapflow saw claimed',
	})
	claimedSequence: number;

	@ApiProperty({
		type: String,
		nullable: true,
		description: 'Why the escrow refused the last claim',
	})
	claimError: string | null;

	@ApiProperty({ type: PaymentVoucherDto, nullable: true })
	latestVoucher: PaymentVoucherDto | null;

	static from(
		channel: PaymentChannel,
		latest: PaymentVoucher | undefined
	): PaymentChannelDto {
		return {
			channelId: channel.channelId,
			leaseId: channel.leaseId,
			sandboxId: channel.sandboxId,
			signingMode: channel.signingMode,
			state: channel.state,
			customerAddress: channel.customerAddress,
			hostAddress: channel.hostAddress,
			openedAt: channel.openedAt,
			closedAt: channel.closedAt,
			coveredAt: channel.coveredAt,
			voucherError: channel.voucherError,
			claimedSequence: channel.claimedSequence,
			claimError: channel.claimError,
			latestVoucher: latest ? PaymentVoucherDto.from(channel, latest) : null,
		};
	}
}

@ApiSchema({ name: 'PaymentChannelPage' })
export class PaymentChannelPageDto extends CursorPageDto<PaymentChannelDto> {
	@ApiProperty({ type: PaymentChannelDto, isArray: true })
	declare items: PaymentChannelDto[];
}

export class ListPaymentChannelsQueryDto extends CursorPageQueryDto {
	@PageLimit(
		PAYMENT_CHANNEL_QUERY.defaultLimit,
		PAYMENT_CHANNEL_QUERY.maximumLimit
	)
	override limit = PAYMENT_CHANNEL_QUERY.defaultLimit;
}

@ApiSchema({ name: 'PendingVoucher' })
export class PendingVoucherDto {
	@ApiProperty({ type: String })
	channelId: Hex;

	@ApiProperty()
	sandboxId: string;

	@ApiProperty({ format: 'uuid' })
	leaseId: string;

	@ApiProperty({ type: PaymentVoucherDto })
	voucher: PaymentVoucherDto;

	static from(
		channel: PaymentChannel,
		voucher: PaymentVoucher
	): PendingVoucherDto {
		return {
			channelId: channel.channelId,
			sandboxId: channel.sandboxId,
			leaseId: channel.leaseId,
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
		pending: readonly [PaymentChannel, PaymentVoucher][]
	): PendingVouchersDto {
		return {
			domain: EscrowDomainDto.from(domain),
			vouchers: pending.map(([channel, voucher]) =>
				PendingVoucherDto.from(channel, voucher)
			),
		};
	}
}
