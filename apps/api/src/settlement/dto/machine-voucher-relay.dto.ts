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
import type { PaymentChannel } from '../entities/payment-channel.entity';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import { PaymentChannelState } from '../enums/payment-channel-state.enum';
import { signedVoucher } from '../utils/voucher-message.util';
import { EscrowDomainDto } from './payment-channel.dto';
import { VoucherMessageDto } from './payment-voucher.dto';

@ApiSchema({ name: 'MachineSignedVoucher' })
export class MachineSignedVoucherDto extends VoucherMessageDto {
	@ApiProperty({ type: String })
	signer: Address;

	@ApiProperty({ type: String })
	signature: Hex;

	static fromSigned(
		channel: PaymentChannel,
		voucher: PaymentVoucher
	): MachineSignedVoucherDto {
		const signed = signedVoucher(channel, voucher);
		return {
			...VoucherMessageDto.from(channel, voucher),
			signer: signed.signer,
			signature: signed.signature,
		};
	}
}

@ApiSchema({ name: 'MachineVoucherChannel' })
export class MachineVoucherChannelDto {
	@ApiProperty()
	sandboxId: string;

	@ApiProperty({ format: 'uuid' })
	leaseId: string;

	@ApiProperty({ type: String })
	channelId: Hex;

	@ApiProperty({ enum: PaymentChannelState, enumName: 'PaymentChannelState' })
	state: PaymentChannelState;

	@ApiProperty({
		type: MachineSignedVoucherDto,
		nullable: true,
		description: 'Latest signed voucher, none before the first one is signed',
	})
	voucher: MachineSignedVoucherDto | null;
}

// Everything a machine needs to verify that the sandboxes it runs are paid
// for; digest identifies the document for If-None-Match long polls.
@ApiSchema({ name: 'MachineVoucherRelay' })
export class MachineVoucherRelayDto {
	@ApiProperty()
	digest: string;

	@ApiProperty({ type: EscrowDomainDto })
	domain: EscrowDomainDto;

	@ApiProperty({ type: 'integer' })
	voucherIntervalSeconds: number;

	@ApiProperty({ type: 'integer' })
	voucherGraceIntervals: number;

	@ApiProperty({ type: MachineVoucherChannelDto, isArray: true })
	channels: MachineVoucherChannelDto[];
}
