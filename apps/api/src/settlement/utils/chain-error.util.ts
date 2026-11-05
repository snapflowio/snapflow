/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BaseError, HttpRequestError, TimeoutError } from 'viem';

// True when the RPC endpoint could not be reached, as opposed to the chain
// answering that a signature or call is invalid.
export function isChainUnreachable(error: unknown): boolean {
	return (
		error instanceof BaseError &&
		error.walk(
			(cause) =>
				cause instanceof HttpRequestError || cause instanceof TimeoutError
		) !== null
	);
}
