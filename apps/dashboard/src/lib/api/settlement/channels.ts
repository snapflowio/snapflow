/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ListPaymentChannelsData } from '@snapflow/api-client';
import {
	getPaymentChannelOptions,
	listPaymentChannelsInfiniteOptions,
} from '@snapflow/api-client/svelte-query';

export function paymentChannelsInfiniteQueryOptions(
	query: ListPaymentChannelsData['query']
) {
	return listPaymentChannelsInfiniteOptions({ query });
}

export function paymentChannelQueryOptions(paymentChannelId: string) {
	return getPaymentChannelOptions({ path: { paymentChannelId } });
}
