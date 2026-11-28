/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapflowWalletCancelledError } from '@snapflow/sdk';
import {
	ConnectorAccountNotFoundError,
	ConnectorChainMismatchError,
	ConnectorNotConnectedError,
} from '@wagmi/core';
import {
	BaseError,
	ChainMismatchError,
	InsufficientFundsError,
	UserRejectedRequestError,
} from 'viem';
import { ClientErrorCode } from '#lib/api/errors/error-catalog.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const PASSKEY_PROMPT_CLOSED_ERROR_NAME = 'NotAllowedError';

function causeChain(error: unknown): unknown[] {
	const chain: unknown[] = [];
	let current = error;
	while (
		current !== undefined &&
		current !== null &&
		!chain.includes(current)
	) {
		chain.push(current);
		current = current instanceof Error ? current.cause : undefined;
	}
	return chain;
}

function walletClientErrorCode(cause: unknown): ClientErrorCode | null {
	if (
		cause instanceof SnapflowWalletCancelledError ||
		cause instanceof UserRejectedRequestError
	) {
		return ClientErrorCode.WALLET_REQUEST_REJECTED;
	}
	if (
		cause instanceof ChainMismatchError ||
		cause instanceof ConnectorChainMismatchError
	) {
		return ClientErrorCode.WALLET_WRONG_NETWORK;
	}
	if (cause instanceof InsufficientFundsError) {
		return ClientErrorCode.WALLET_INSUFFICIENT_GAS;
	}
	if (
		cause instanceof ConnectorNotConnectedError ||
		cause instanceof ConnectorAccountNotFoundError
	) {
		return ClientErrorCode.WALLET_NOT_CONNECTED;
	}
	if (
		cause instanceof DOMException &&
		cause.name === PASSKEY_PROMPT_CLOSED_ERROR_NAME
	) {
		return ClientErrorCode.WALLET_PASSKEY_PROMPT_CLOSED;
	}
	return null;
}

export function walletError(error: unknown): SnapflowError {
	for (const cause of causeChain(error)) {
		const code = walletClientErrorCode(cause);
		if (code !== null) return new SnapflowError('', { code, cause: error });
	}
	return error instanceof BaseError
		? new SnapflowError(error.shortMessage, { cause: error })
		: SnapflowError.fromUnknown(error);
}

export async function walletCall<T>(call: () => Promise<T>): Promise<T> {
	try {
		return await call();
	} catch (error) {
		throw walletError(error);
	}
}

export function walletMutationFn<TVariables, TData>(
	mutationFn: (variables: TVariables) => Promise<TData>
): (variables: TVariables) => Promise<TData> {
	return (variables) => walletCall(() => mutationFn(variables));
}

export function walletFailure(
	fallback: string
): (error: unknown) => string | undefined {
	return (error) =>
		walletError(error).code === ClientErrorCode.WALLET_REQUEST_REJECTED
			? undefined
			: fallback;
}
