/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isHash } from 'viem';
import * as z from 'zod';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';

export const REFUND_SORT_OPTIONS = [
	{ id: 'customer', label: 'Customer' },
	{ id: 'due', label: 'Amount due' },
	{ id: 'ended', label: 'Ended' },
] as const;

export const REFUND_FILTER_KEYS = [] as const;

export const refundsSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['customer', 'due', 'ended']),
});

export const recordRefundSchema = z.object({
	transactionHash: z
		.string()
		.trim()
		.refine((value) => isHash(value), 'Enter a 0x-prefixed 32-byte hash'),
});
