/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BaseError } from 'viem';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

export function walletError(error: unknown): SnapflowError {
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
