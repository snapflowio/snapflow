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
import { ConflictException, Injectable } from '@nestjs/common';
import { BillingLedgerService } from '../../../billing/services/ledger/billing-ledger.service';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { SettlementErrorCode } from '../../constants/payment-channel.constants';
import {
	PaymentChannelRefundDto,
	type RecordPaymentChannelRefundDto,
	RefundDueDto,
} from '../../dto/payment-channel-refund.dto';
import { PaymentChannel } from '../../entities/payment-channel.entity';
import { PaymentChannelCharge } from '../../entities/payment-channel-charge.entity';
import { PaymentChannelRefund } from '../../entities/payment-channel-refund.entity';
import { PaymentChannelNotFoundException } from '../../exceptions/payment-channel-not-found.exception';
import { refundsDue } from '../../queries/refunds-due.query';
import { refundDue } from '../../utils/channels/channel-charge.util';
import { channelRefundPosting } from '../../utils/channels/channel-refund-posting.util';
import { microUsd } from '../../utils/escrow/escrow-amount.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import { normalizedTransactionHash } from '../../utils/escrow/settlement-transaction-hash.util';

function refundNotDue(): ConflictException {
	return new ConflictException({
		code: SettlementErrorCode.REFUND_NOT_DUE,
		message:
			'The payment channel owes no refund: its charges are still being metered or it was already refunded',
	});
}

function refundAmountChanged(dueMicroUsd: bigint): ConflictException {
	return new ConflictException({
		code: SettlementErrorCode.REFUND_AMOUNT_CHANGED,
		message: `The payment channel now owes ${dueMicroUsd} micro-USD, not the amount submitted; reload the refunds and record the transaction against the current amount`,
	});
}

@Injectable()
export class PaymentChannelRefundService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly ledger: BillingLedgerService
	) {}

	async due(): Promise<RefundDueDto[]> {
		const due = await refundsDue(
			this.entityManager.fork(),
			configuredEscrow(this.config)
		);
		return due.map((refund) => RefundDueDto.from(refund));
	}

	async record(
		paymentChannelId: string,
		userId: string,
		input: RecordPaymentChannelRefundDto
	): Promise<PaymentChannelRefundDto> {
		try {
			return await this.entityManager.fork().transactional(async (manager) => {
				const channel = await manager.findOne(
					PaymentChannel,
					{ ...configuredEscrow(this.config), id: paymentChannelId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!channel) throw new PaymentChannelNotFoundException();
				const charges = await manager.find(PaymentChannelCharge, {
					paymentChannelId,
				});
				const amount = refundDue(channel, charges);
				const metered =
					charges.length > 0 &&
					charges.every(({ settledAt }) => settledAt !== null);
				if (!metered || amount === 0n) throw refundNotDue();
				if (amount !== microUsd(input.dueMicroUsd)) {
					throw refundAmountChanged(amount);
				}
				channel.refundedMicroUsd = (
					microUsd(channel.refundedMicroUsd) + amount
				).toString();
				const refund = manager.create(PaymentChannelRefund, {
					paymentChannelId,
					amountMicroUsd: amount.toString(),
					transactionHash: normalizedTransactionHash(input.transactionHash),
					refundedByUserId: userId,
				});
				await manager.flush();
				await this.ledger.post(manager, channelRefundPosting(channel, refund));
				return PaymentChannelRefundDto.from(refund);
			});
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;
			throw new ConflictException({
				code: SettlementErrorCode.REFUND_ALREADY_RECORDED,
				message:
					'A refund with this transaction hash is already recorded for this payment channel',
			});
		}
	}
}
