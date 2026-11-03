/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Archive from '@lucide/svelte/icons/archive';
import Copy from '@lucide/svelte/icons/copy';
import Pause from '@lucide/svelte/icons/pause';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import Square from '@lucide/svelte/icons/square';
import { type SandboxListItem, SandboxState } from '@snapflow/api-client';
import type {
	SandboxBulkAction,
	SandboxLifecycleAction,
} from '#lib/api/sandboxes/sandboxes.ts';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import Play from '#lib/components/icons/play.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import type { ResourceActionPermissions } from '#lib/features/organizations/lib/organization-permission.ts';
import { pluralize } from '#lib/utils/text.ts';
import {
	canDeleteSandbox,
	canRunSandboxLifecycleAction,
} from './sandbox-state.ts';

export const BULK_LIFECYCLE_ACTIONS = [
	'start',
	'pause',
	'stop',
	'archive',
	'recover',
] as const satisfies readonly SandboxLifecycleAction[];

interface SandboxActionCopy {
	label: string;
	pendingLabel: string;
	doneLabel: string;
	icon: IconComponent;
}

export const SANDBOX_ACTION_COPY: Record<SandboxBulkAction, SandboxActionCopy> =
	{
		start: {
			label: 'Start',
			pendingLabel: 'Starting...',
			doneLabel: 'Started',
			icon: Play,
		},
		pause: {
			label: 'Pause',
			pendingLabel: 'Pausing...',
			doneLabel: 'Paused',
			icon: Pause,
		},
		stop: {
			label: 'Stop',
			pendingLabel: 'Stopping...',
			doneLabel: 'Stopped',
			icon: Square,
		},
		archive: {
			label: 'Archive',
			pendingLabel: 'Archiving...',
			doneLabel: 'Archived',
			icon: Archive,
		},
		recover: {
			label: 'Recover',
			pendingLabel: 'Recovering...',
			doneLabel: 'Recovered',
			icon: RotateCcw,
		},
		delete: {
			label: 'Delete',
			pendingLabel: 'Deleting...',
			doneLabel: 'Deleted',
			icon: Trash,
		},
	};

export function sandboxCountLabel(count: number): string {
	return pluralize(count, 'sandbox', 'sandboxes');
}

export function selectionActionLabel(
	action: SandboxBulkAction,
	count: number
): string {
	const { label } = SANDBOX_ACTION_COPY[action];
	return count <= 1 ? label : `${label} ${sandboxCountLabel(count)}`;
}

export function bulkResultMessage(
	action: SandboxBulkAction,
	succeeded: number,
	failed: number
): string {
	const done = `${SANDBOX_ACTION_COPY[action].doneLabel} ${sandboxCountLabel(succeeded)}`;
	return failed > 0 ? `${done}, ${failed} failed` : done;
}

export function visibleLifecycleActions(
	sandbox: Pick<SandboxListItem, 'recoverable' | 'state'>
): SandboxLifecycleAction[] {
	if (canRunSandboxLifecycleAction(sandbox, 'recover')) return ['recover'];
	const actions: SandboxLifecycleAction[] = [];
	if (canRunSandboxLifecycleAction(sandbox, 'start')) actions.push('start');
	else if (sandbox.state === SandboxState.Started) {
		actions.push('pause', 'stop');
	}
	if (canRunSandboxLifecycleAction(sandbox, 'archive')) actions.push('archive');
	return actions;
}

interface SandboxRowActionHandlers {
	onAction: (action: SandboxLifecycleAction) => void;
	onCopyId: () => void;
	onDelete: () => void;
}

export function sandboxRowActions(
	sandbox: SandboxListItem,
	permissions: ResourceActionPermissions,
	{ onAction, onCopyId, onDelete }: SandboxRowActionHandlers
): ResourceRowAction[] {
	const lifecycle = permissions.canWrite
		? visibleLifecycleActions(sandbox).map((action) => ({
				icon: SANDBOX_ACTION_COPY[action].icon,
				label: SANDBOX_ACTION_COPY[action].label,
				onSelect: () => onAction(action),
			}))
		: [];
	return [
		...lifecycle,
		{ icon: Copy, label: 'Copy ID', onSelect: onCopyId },
		{
			icon: Trash,
			label: 'Delete',
			onSelect: onDelete,
			separated: true,
			visible: permissions.canDelete && canDeleteSandbox(sandbox),
		},
	];
}

interface SandboxSelectionActionHandlers {
	onAction: (action: SandboxLifecycleAction) => void;
	onDelete: () => void;
}

export function sandboxSelectionActions(
	counts: Readonly<Record<SandboxBulkAction, number>>,
	permissions: ResourceActionPermissions,
	{ onAction, onDelete }: SandboxSelectionActionHandlers
): ResourceRowAction[] {
	const lifecycle = permissions.canWrite
		? BULK_LIFECYCLE_ACTIONS.filter((action) => counts[action] > 0).map(
				(action) => ({
					icon: SANDBOX_ACTION_COPY[action].icon,
					label: selectionActionLabel(action, counts[action]),
					onSelect: () => onAction(action),
				})
			)
		: [];
	return [
		...lifecycle,
		{
			icon: Trash,
			label: selectionActionLabel('delete', counts.delete),
			onSelect: onDelete,
			separated: true,
			visible: permissions.canDelete && counts.delete > 0,
		},
	];
}
