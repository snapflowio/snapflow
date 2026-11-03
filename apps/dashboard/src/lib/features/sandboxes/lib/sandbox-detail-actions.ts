/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '@snapflow/api-client';
import type { SandboxLifecycleAction } from '#lib/api/sandboxes/sandboxes.ts';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import { canRunSandboxLifecycleAction } from '#lib/features/sandboxes/lib/sandbox-state.ts';

export type SandboxHeaderAction = Exclude<SandboxLifecycleAction, 'start'>;

export const ACTION_REQUESTED_MESSAGES: Record<SandboxHeaderAction, string> = {
	archive: 'Archive requested',
	pause: 'Pause requested',
	recover: 'Recovery requested',
	stop: 'Stop requested',
};

export function primaryLifecycleAction(
	sandbox: Sandbox
): Exclude<SandboxLifecycleAction, 'archive' | 'pause'> | null {
	if (canRunSandboxLifecycleAction(sandbox, 'recover')) return 'recover';
	if (canRunSandboxLifecycleAction(sandbox, 'start')) return 'start';
	if (canRunSandboxLifecycleAction(sandbox, 'stop')) return 'stop';
	return null;
}

export function deleteSandboxCopy(sandbox: Sandbox | null): ChipConfirmCopy {
	return {
		title: 'Delete sandbox',
		text: [
			'Are you sure you want to delete ',
			{ text: sandbox?.name ?? '', bold: true },
			'? ',
			{ text: 'It will be destroyed.', error: true },
			' Accounting and audit evidence is retained.',
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}
