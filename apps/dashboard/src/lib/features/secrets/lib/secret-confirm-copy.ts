/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SecretDto } from '@snapflow/api-client';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';

export function deleteSecretCopy(secret: SecretDto | null): ChipConfirmCopy {
	return {
		title: 'Delete secret',
		text: [
			'Are you sure you want to delete ',
			{ text: secret?.name ?? 'this secret', bold: true },
			'? ',
			{ text: 'Its values cannot be recovered.', error: true },
			' Secrets bound to an active sandbox cannot be deleted.',
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}
