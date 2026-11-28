/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Logger, ServiceUnavailableException } from '@nestjs/common';
import {
	type Abi,
	BaseError,
	ContractFunctionRevertedError,
	decodeErrorResult,
	HttpRequestError,
	RawContractError,
	TimeoutError,
} from 'viem';
import { SettlementErrorCode } from '../constants/payment-channel.constants';

export function isChainUnreachable(error: unknown): boolean {
	return (
		error instanceof BaseError &&
		error.walk(
			(cause) =>
				cause instanceof HttpRequestError || cause instanceof TimeoutError
		) !== null
	);
}

export async function withSettlementChain<T>(
	logger: Logger,
	work: () => Promise<T>
): Promise<T> {
	try {
		return await work();
	} catch (error) {
		if (!isChainUnreachable(error)) throw error;
		logger.error('Could not reach the settlement chain', error);
		throw new ServiceUnavailableException(
			{
				code: SettlementErrorCode.CHAIN_UNAVAILABLE,
				message: 'The settlement chain is unreachable; retry shortly',
			},
			{ cause: error }
		);
	}
}

export function contractRevertReason(error: unknown): string {
	if (!(error instanceof BaseError)) throw error;
	const reverted = error.walk(
		(cause) => cause instanceof ContractFunctionRevertedError
	);
	if (reverted instanceof ContractFunctionRevertedError) {
		return reverted.data?.errorName ?? reverted.reason ?? reverted.shortMessage;
	}
	return error.shortMessage;
}

export function callRevertReason(error: unknown, abi: Abi): string {
	if (!(error instanceof BaseError)) throw error;
	const raw = error.walk((cause) => cause instanceof RawContractError);
	const revert = raw instanceof RawContractError ? raw.data : undefined;
	const data = typeof revert === 'object' ? revert.data : revert;
	if (data === undefined) return error.shortMessage;
	try {
		const { errorName, args } = decodeErrorResult({ abi, data });
		const [first] = args ?? [];
		return typeof first === 'string' ? first : errorName;
	} catch {
		return error.shortMessage;
	}
}
