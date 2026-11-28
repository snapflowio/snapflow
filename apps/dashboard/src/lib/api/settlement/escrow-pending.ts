/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiErrorCode, type EscrowPendingChanges } from '@snapflow/api-client';
import { getEscrowPendingChangesOptions } from '@snapflow/api-client/svelte-query';
import { queryOptions } from '@tanstack/svelte-query';
import { hasErrorCode } from '#lib/api/errors/api-error-details.ts';
import { ESCROW_REFRESH_INTERVAL_MILLISECONDS } from './escrow.ts';

const ACTIVE_REFRESH_INTERVAL_MILLISECONDS = 5_000;
const PENDING_RETRY_COUNT = 1;

function hasPendingChanges(changes: EscrowPendingChanges | undefined): boolean {
	return Boolean(
		changes &&
			(changes.deposits.length > 0 || changes.withdrawalChanges.length > 0)
	);
}

export function escrowPendingUnavailable(error: unknown): boolean {
	return hasErrorCode(error, ApiErrorCode.SettlementChainUnavailable);
}

export function escrowPendingChangesQueryOptions() {
	return queryOptions({
		...getEscrowPendingChangesOptions(),
		retry: (failureCount, error) =>
			!escrowPendingUnavailable(error) && failureCount < PENDING_RETRY_COUNT,
		refetchInterval: (query) =>
			hasPendingChanges(query.state.data)
				? ACTIVE_REFRESH_INTERVAL_MILLISECONDS
				: ESCROW_REFRESH_INTERVAL_MILLISECONDS,
	});
}
