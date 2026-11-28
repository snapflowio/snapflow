/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { listHostNetworkUsage } from '@snapflow/api-client';
import { listHostNetworkUsageQueryKey } from '@snapflow/api-client/svelte-query';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';

export function hostNetworkUsageSinceQueryOptions(from: string) {
	const query = { from };
	return allPagesOptions(
		listHostNetworkUsageQueryKey({ query }),
		async (cursor, signal) =>
			(await listHostNetworkUsage({ query: { ...query, cursor }, signal })).data
	);
}
