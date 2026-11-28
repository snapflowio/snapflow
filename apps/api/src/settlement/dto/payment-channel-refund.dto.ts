/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import type { Address, Hash } from 'viem';
import { MICRO_USD_PATTERN } from '../../common/constants/money.constants';
import {
	EVM_ADDRESS_API_PROPERTY,
	EVM_HASH_PATTERN,
	UINT_STRING_API_PROPERTY,
} from '../constants/settlement.constants';
import type { PaymentChannelRefund } from '../entities/payment-channel-refund.entity';
import type { refundsDue } from '../queries/refunds-due.query';

type RefundDue = Awaited<ReturnType<typeof refundsDue>>[number];

const TRANSACTION_HASH_PROPERTY = {
	type: String,
	pattern: EVM_HASH_PATTERN.source,
	description: 'Hash of the fee wallet transaction that paid the refund',
} as const;

@ApiSchema({ name: 'RefundDue' })
export class RefundDueDto {
	@ApiProperty({ format: 'uuid' })
	paymentChannelId: string;

	@ApiProperty({ format: 'uuid' })
	customerOrganizationId: string;

	@ApiProperty()
	customerOrganizationName: string;

	@ApiProperty({
		...EVM_ADDRESS_API_PROPERTY,
		description: 'The funding wallet to send the refund to',
	})
	customerAddress: Address;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'What the channel still owes the customer, micro-USD',
	})
	dueMicroUsd: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'What was already refunded on the channel, micro-USD',
	})
	refundedMicroUsd: string;

	@ApiProperty({
		type: String,
		format: 'date-time',
		description: 'When the last charge of the channel ended',
	})
	endedAt: Date;

	static from(due: RefundDue): RefundDueDto {
		return {
			paymentChannelId: due.paymentChannelId,
			customerOrganizationId: due.customerOrganizationId,
			customerOrganizationName: due.customerOrganizationName,
			customerAddress: due.customerAddress,
			dueMicroUsd: due.dueMicroUsd.toString(),
			refundedMicroUsd: due.refundedMicroUsd.toString(),
			endedAt: due.endedAt,
		};
	}
}

@ApiSchema({ name: 'RecordPaymentChannelRefund' })
export class RecordPaymentChannelRefundDto {
	@ApiProperty(TRANSACTION_HASH_PROPERTY)
	@Matches(EVM_HASH_PATTERN)
	transactionHash: Hash;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description:
			'The amount due the admin saw and sent, micro-USD; rejected if the channel now owes a different amount',
	})
	@Matches(MICRO_USD_PATTERN)
	dueMicroUsd: string;
}

@ApiSchema({ name: 'PaymentChannelRefund' })
export class PaymentChannelRefundDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ format: 'uuid' })
	paymentChannelId: string;

	@ApiProperty({
		...UINT_STRING_API_PROPERTY,
		description: 'The refunded amount, micro-USD',
	})
	amountMicroUsd: string;

	@ApiProperty(TRANSACTION_HASH_PROPERTY)
	transactionHash: Hash;

	@ApiProperty({
		type: String,
		format: 'uuid',
		nullable: true,
		description: 'The admin who recorded the refund',
	})
	refundedByUserId: string | null;

	@ApiProperty({ type: String, format: 'date-time' })
	refundedAt: Date;

	static from(refund: PaymentChannelRefund): PaymentChannelRefundDto {
		return {
			id: refund.id,
			paymentChannelId: refund.paymentChannelId,
			amountMicroUsd: refund.amountMicroUsd,
			transactionHash: refund.transactionHash,
			refundedByUserId: refund.refundedByUserId,
			refundedAt: refund.refundedAt,
		};
	}
}
