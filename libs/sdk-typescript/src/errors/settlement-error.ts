/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseError, ContractFunctionRevertedError, type Hash } from 'viem';
import { SnapflowError } from './snapflow-error.js';

export const VoucherRejectionReason = {
	Malformed: 'voucher_malformed',
	DomainMismatch: 'voucher_domain_mismatch',
	ChannelMismatch: 'voucher_channel_mismatch',
	CustomerMismatch: 'voucher_customer_mismatch',
	FeeMismatch: 'voucher_fee_mismatch',
	TimestampOutOfRange: 'voucher_timestamp_out_of_range',
	StaleSequence: 'voucher_stale_sequence',
	AmountDecreased: 'voucher_amount_decreased',
	ChannelCapExceeded: 'voucher_channel_cap_exceeded',
	HourlyRateExceeded: 'voucher_hourly_rate_exceeded',
} as const;

export type VoucherRejectionReason =
	(typeof VoucherRejectionReason)[keyof typeof VoucherRejectionReason];

export class SnapflowVoucherRejectedError extends SnapflowError {
	public readonly paymentChannelId: string;
	public readonly sequence: number;
	public readonly reason: VoucherRejectionReason;

	constructor(
		message: string,
		details: Pick<
			SnapflowVoucherRejectedError,
			'paymentChannelId' | 'sequence' | 'reason'
		>
	) {
		super(message, undefined, undefined, details.reason);
		this.paymentChannelId = details.paymentChannelId;
		this.sequence = details.sequence;
		this.reason = details.reason;
	}
}

export class SnapflowEscrowError extends SnapflowError {
	public readonly contractError?: string;
	public readonly transactionHash?: Hash;

	constructor(
		message: string,
		details: Pick<SnapflowEscrowError, 'contractError' | 'transactionHash'>,
		cause?: unknown
	) {
		super(message, undefined, undefined, details.contractError, { cause });
		this.contractError = details.contractError;
		this.transactionHash = details.transactionHash;
	}
}

function revertedContractError(error: BaseError): string | undefined {
	const reverted = error.walk(
		(cause) => cause instanceof ContractFunctionRevertedError
	);
	return reverted instanceof ContractFunctionRevertedError
		? (reverted.data?.errorName ?? reverted.reason)
		: undefined;
}

export function toEscrowError(
	error: unknown,
	transactionHash?: Hash
): SnapflowEscrowError {
	if (error instanceof SnapflowEscrowError) {
		return error;
	}
	if (error instanceof BaseError) {
		return new SnapflowEscrowError(
			error.shortMessage,
			{ contractError: revertedContractError(error), transactionHash },
			error
		);
	}
	return new SnapflowEscrowError(
		error instanceof Error ? error.message : String(error),
		{ transactionHash },
		error
	);
}
