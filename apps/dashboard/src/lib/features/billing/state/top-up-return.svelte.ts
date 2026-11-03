/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useQueryClient } from '@tanstack/svelte-query';
import {
	announceTopUp,
	TOP_UP_RETURN_QUERY_KEY,
} from '#lib/features/billing/lib/top-up-result.ts';
import { consumeSearchParam } from '#lib/routing/consume-search-param.svelte.ts';

export function settleReturnedTopUp(): void {
	const queryClient = useQueryClient();
	consumeSearchParam(TOP_UP_RETURN_QUERY_KEY, (topUpId) => {
		void announceTopUp(queryClient, topUpId);
	});
}
