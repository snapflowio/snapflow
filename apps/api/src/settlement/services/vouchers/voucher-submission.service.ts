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
import { escrowDomain, voucherTypedData } from '@snapflow/contracts';
import {
	type Address,
	getAddress,
	type Hex,
	isAddressEqual,
	recoverTypedDataAddress,
} from 'viem';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import {
	SETTLEMENT_WAKE_TOPIC,
	SettlementErrorCode,
	VOUCHER_REJECTION_MESSAGES,
	type VoucherRejectionCode,
} from '../../constants/payment-channel.constants';
import {
	PaymentVoucherDto,
	type SubmitVoucherSignatureDto,
} from '../../dto/payment-voucher.dto';
import { PaymentChannel } from '../../entities/payment-channel.entity';
import { PaymentVoucher } from '../../entities/payment-voucher.entity';
import { PaymentChannelNotFoundException } from '../../exceptions/payment-channel-not-found.exception';
import { boundCharge } from '../../utils/channels/channel-charge.util';
import { microUsd } from '../../utils/escrow/escrow-amount.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import { voucherMessage } from '../../utils/vouchers/voucher-message.util';
import { VoucherSignerScopeService } from './voucher-signer-scope.service';

@Injectable()
export class VoucherSubmissionService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly scopes: VoucherSignerScopeService,
		private readonly wakes: ControlWakeService
	) {}

	submit(
		organizationId: string,
		input: SubmitVoucherSignatureDto
	): Promise<PaymentVoucherDto> {
		const signerAddress = getAddress(input.signer);
		return this.entityManager.fork().transactional(async (manager) => {
			const channel = await manager.findOne(
				PaymentChannel,
				{
					...configuredEscrow(this.config),
					id: input.paymentChannelId,
					customerOrganizationId: organizationId,
				},
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!channel) throw new PaymentChannelNotFoundException();
			const voucher = await this.voucher(manager, channel, input.sequence);
			if (voucher.signature !== null) {
				if (
					voucher.signerAddress !== null &&
					isAddressEqual(voucher.signerAddress, signerAddress) &&
					voucher.signature.toLowerCase() === input.signature.toLowerCase()
				) {
					return PaymentVoucherDto.from(channel, voucher);
				}
				throw new ConflictException({
					code: SettlementErrorCode.VOUCHER_ALREADY_SIGNED,
					message: 'The voucher is already signed',
				});
			}
			await this.assertCurrent(manager, voucher);
			await this.assertSignature(manager, channel, voucher, {
				signerAddress,
				signature: input.signature,
			});
			manager.assign(voucher, {
				signerAddress,
				signature: input.signature,
				signedAt: await databaseNow(manager),
			});
			channel.signedMicroUsd = voucher.cumulativeMicroUsd;
			const charged = microUsd(channel.chargedMicroUsd);
			channel.chargedMicroUsd = boundCharge(charged, channel).toString();
			if (microUsd(channel.signedMicroUsd) >= charged) {
				channel.voucherError = null;
			}
			if (voucher.createdAt > channel.coveredAt) {
				channel.coveredAt = voucher.createdAt;
			}
			if (channel.machineId !== null) {
				this.wakes.notifyAfterCommit(manager, SETTLEMENT_WAKE_TOPIC, [
					channel.machineId,
				]);
			}
			return PaymentVoucherDto.from(channel, voucher);
		});
	}

	private async voucher(
		manager: EntityManager,
		channel: PaymentChannel,
		sequence: number
	): Promise<PaymentVoucher> {
		const voucher = await manager.findOne(
			PaymentVoucher,
			{ paymentChannelId: channel.id, sequence },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!voucher) {
			throw new NotFoundException({
				code: SettlementErrorCode.VOUCHER_NOT_FOUND,
				message: 'The channel has no voucher with this sequence',
			});
		}
		return voucher;
	}

	private async assertCurrent(
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
				code: SettlementErrorCode.VOUCHER_SUPERSEDED,
				message: 'A newer voucher of the channel is already signed',
			});
		}
	}

	private async assertSignature(
		manager: EntityManager,
		channel: PaymentChannel,
		voucher: PaymentVoucher,
		submitted: { signerAddress: Address; signature: Hex }
	): Promise<void> {
		const typedData = voucherTypedData(
			escrowDomain(channel.chainId, channel.contractAddress),
			voucherMessage(channel, voucher)
		);
		const recovered = await recoverTypedDataAddress({
			...typedData,
			signature: submitted.signature,
		}).catch((error: unknown) => {
			if (error instanceof Error) return null;
			throw error;
		});
		if (
			recovered === null ||
			!isAddressEqual(recovered, submitted.signerAddress)
		) {
			throw this.rejection(SettlementErrorCode.SIGNATURE_INVALID);
		}
		if (isAddressEqual(submitted.signerAddress, channel.customerAddress)) {
			return;
		}
		const scope = await this.scopes.forSubmission(
			manager,
			channel,
			submitted.signerAddress,
			voucher.timestamp,
			microUsd(channel.claimedMicroUsd)
		);
		if (scope.unusable !== null) {
			throw this.rejection(SettlementErrorCode.SIGNER_NOT_USABLE);
		}
		if (
			scope.bound !== null &&
			microUsd(voucher.cumulativeMicroUsd) > scope.bound
		) {
			throw this.rejection(SettlementErrorCode.SIGNER_CAP_EXCEEDED);
		}
	}

	private rejection(code: VoucherRejectionCode): UnprocessableEntityException {
		return new UnprocessableEntityException({
			code,
			message: VOUCHER_REJECTION_MESSAGES[code],
		});
	}
}
