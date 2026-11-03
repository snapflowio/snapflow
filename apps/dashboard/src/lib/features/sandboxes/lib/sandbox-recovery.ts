/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';

export type NamedRecoveryAction = 'fork' | 'snapshot';

export const DEFAULT_RECOVERY_ACTION: NamedRecoveryAction = 'fork';

export const NAMED_ACTION_COPY = {
	fork: { title: 'Fork sandbox', label: 'Fork', pendingLabel: 'Forking...' },
	snapshot: {
		title: 'Create snapshot',
		label: 'Create',
		pendingLabel: 'Creating...',
	},
} as const satisfies Record<
	NamedRecoveryAction,
	{ title: string; label: string; pendingLabel: string }
>;

export const namedRecoverySchema = z
	.object({
		action: z.enum(['fork', 'snapshot']),
		name: z.string(),
	})
	.superRefine((value, context) => {
		if (value.action === 'snapshot' && !value.name.trim()) {
			context.addIssue({
				code: 'custom',
				message: 'Snapshot name is required',
				path: ['name'],
			});
		}
	});
