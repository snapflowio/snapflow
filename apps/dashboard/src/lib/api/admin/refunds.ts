/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	adminListRefundsDueOptions,
	adminListRefundsDueQueryKey,
	adminRecordPaymentChannelRefundMutation,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';

export function adminRefundsDueQueryOptions() {
	return adminListRefundsDueOptions();
}

export function recordRefundMutationOptions() {
	return mutationOptions({
		...adminRecordPaymentChannelRefundMutation(),
		meta: {
			success: 'Refund recorded',
			failure: 'Failed to record the refund',
			invalidates: [adminListRefundsDueQueryKey()],
		},
	});
}
