/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SnapshotDto } from '@snapflow/api-client';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import { pluralize } from '#lib/utils/text.ts';

export function deleteSnapshotCopy(
	snapshot: SnapshotDto | null
): ChipConfirmCopy {
	return {
		title: 'Delete snapshot',
		text: [
			'Are you sure you want to delete ',
			{ text: snapshot?.name ?? 'this snapshot', bold: true },
			'? ',
			{ text: 'This action cannot be undone.', error: true },
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}

export function deleteSnapshotsCopy(
	snapshots: readonly SnapshotDto[]
): ChipConfirmCopy {
	return {
		title: 'Delete snapshots',
		text: [
			'Are you sure you want to delete ',
			{ text: pluralize(snapshots.length, 'snapshot'), bold: true },
			'? ',
			{ text: 'This action cannot be undone.', error: true },
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}
