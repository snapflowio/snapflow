/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { getAddress, isAddressEqual } from 'viem';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import {
	PaymentChannelErrorCode,
	VOUCHER_REJECTION_MESSAGES,
} from '../constants/payment-channel.constants';
import {
	PaymentVoucherDto,
	type SubmitVoucherSignatureDto,
} from '../dto/payment-voucher.dto';
import { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentVoucher } from '../entities/payment-voucher.entity';
import { configuredEscrow } from '../utils/escrow-identity.util';
import { parseChannelId } from '../utils/voucher-message.util';
import { VoucherSigningService } from './voucher-signing.service';

// Accepts the signature a customer's SDK or agent made for a voucher.
// Submitting the same signature for the same voucher again returns it
// unchanged.
@Injectable()
export class VoucherSubmissionService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly signing: VoucherSigningService
	) {}

	submit(
		organizationId: string,
		input: SubmitVoucherSignatureDto
	): Promise<PaymentVoucherDto> {
		const signerAddress = getAddress(input.signer);
		const signature = input.signature;
		return this.entityManager.fork().transactional(async (manager) => {
			const channel = await this.channel(manager, organizationId, input);
			const voucher = await manager.findOne(
				PaymentVoucher,
				{ paymentChannelId: channel.id, sequence: input.sequence },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!voucher) {
				throw new NotFoundException({
					code: PaymentChannelErrorCode.VOUCHER_NOT_FOUND,
					message: 'The channel has no voucher with this sequence',
				});
			}
			if (voucher.signature !== null) {
				if (
					voucher.signerAddress !== null &&
					isAddressEqual(voucher.signerAddress, signerAddress) &&
					voucher.signature.toLowerCase() === signature.toLowerCase()
				) {
					return PaymentVoucherDto.from(channel, voucher);
				}
				throw new ConflictException({
					code: PaymentChannelErrorCode.VOUCHER_ALREADY_SIGNED,
					message: 'The voucher is already signed',
				});
			}
			await this.assertSignable(manager, voucher);
			const rejection = await this.signing.acceptSignature(
				manager,
				channel,
				voucher,
				{ signerAddress, signature },
				await databaseNow(manager)
			);
			if (rejection !== null) {
				throw new UnprocessableEntityException({
					code: rejection,
					message: VOUCHER_REJECTION_MESSAGES[rejection],
				});
			}
			return PaymentVoucherDto.from(channel, voucher);
		});
	}

	private async channel(
		manager: EntityManager,
		organizationId: string,
		input: SubmitVoucherSignatureDto
	): Promise<PaymentChannel> {
		const channelId = parseChannelId(input.channelId);
		const channel = channelId
			? await manager.findOne(
					PaymentChannel,
					{
						...configuredEscrow(this.config),
						channelId,
						customerOrganizationId: organizationId,
					},
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				)
			: null;
		if (!channel) {
			throw new NotFoundException({
				code: PaymentChannelErrorCode.CHANNEL_NOT_FOUND,
				message: 'Payment channel not found',
			});
		}
		return channel;
	}

	// A signature for a voucher a newer signed one replaced, or one past its
	// expiry, could never be claimed.
	private async assertSignable(
		manager: EntityManager,
		voucher: PaymentVoucher
	): Promise<void> {
		const newerSigned = await manager.count(PaymentVoucher, {
			paymentChannelId: voucher.paymentChannelId,
			sequence: { $gt: voucher.sequence },
			signature: { $ne: null },
		});
		if (newerSigned > 0) {
			throw new ConflictException({
				code: PaymentChannelErrorCode.VOUCHER_SUPERSEDED,
				message: 'A newer voucher of the channel is already signed',
			});
		}
		if (voucher.expiresAt <= (await databaseNow(manager))) {
			throw new ConflictException({
				code: PaymentChannelErrorCode.VOUCHER_EXPIRED,
				message: 'The voucher has expired',
			});
		}
	}
}
