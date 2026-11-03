/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { DockerRegistry } from '@snapflow/api-client';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';

export function deleteRegistryCopy(
	registry: DockerRegistry | null
): ChipConfirmCopy {
	return {
		title: 'Delete registry',
		text: [
			'Are you sure you want to delete ',
			{ text: registry?.name ?? 'this registry', bold: true },
			'? ',
			{ text: 'Images from it can no longer be pulled.', error: true },
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}
