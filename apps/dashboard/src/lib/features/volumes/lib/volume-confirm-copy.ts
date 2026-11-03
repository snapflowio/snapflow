/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { VolumeDto } from '@snapflow/api-client';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import { pluralize } from '#lib/utils/text.ts';

export function deleteVolumeCopy(volume: VolumeDto | null): ChipConfirmCopy {
	return {
		title: 'Delete volume',
		text: [
			'Are you sure you want to delete ',
			{ text: volume?.name ?? 'this volume', bold: true },
			'? ',
			{ text: 'All data stored on it will be lost.', error: true },
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}

export function deleteVolumesCopy(
	volumes: readonly VolumeDto[]
): ChipConfirmCopy {
	return {
		title: 'Delete volumes',
		text: [
			'Are you sure you want to delete ',
			{ text: pluralize(volumes.length, 'volume'), bold: true },
			'? ',
			{ text: 'All data stored on them will be lost.', error: true },
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}
