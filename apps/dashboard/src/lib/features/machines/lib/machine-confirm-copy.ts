/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Machine } from '@snapflow/api-client';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import { pluralize } from '#lib/utils/text.ts';

export function drainMachineCopy(machine: Machine | null): ChipConfirmCopy {
	return {
		title: 'Start decommissioning',
		text: [
			{ text: machine?.name ?? '', bold: true },
			' stops receiving new sandboxes and moves its running ones off the machine. ',
			{
				text: 'When draining completes, its identity is revoked and it must be enrolled again before it can reconnect.',
				error: true,
			},
		],
		confirmLabel: 'Start decommissioning',
		pendingLabel: 'Starting...',
	};
}

export function revokeMachineCopy(machine: Machine | null): ChipConfirmCopy {
	return {
		title: 'Revoke identity',
		text: [
			'This immediately fences ',
			{ text: machine?.name ?? '', bold: true },
			'. ',
			{
				text: 'The machine must run sudo snapflow setup --replace and be approved again before it can reconnect.',
				error: true,
			},
		],
		confirmLabel: 'Revoke identity',
		pendingLabel: 'Revoking...',
	};
}

export function deleteMachineCopy(machine: Machine | null): ChipConfirmCopy {
	return {
		title: 'Delete machine',
		text: [
			'Are you sure you want to delete ',
			{ text: machine?.name ?? '', bold: true },
			'? ',
			{ text: 'The machine is removed permanently.', error: true },
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}

export function deleteMachinesCopy(
	machines: readonly Machine[]
): ChipConfirmCopy {
	const count = pluralize(machines.length, 'machine');
	return {
		title: `Delete ${count}`,
		text: [
			'Are you sure you want to delete ',
			{ text: count, bold: true },
			'? ',
			{ text: 'The machines are removed permanently.', error: true },
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}
