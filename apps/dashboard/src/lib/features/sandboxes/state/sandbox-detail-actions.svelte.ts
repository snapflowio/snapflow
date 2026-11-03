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
import FolderInput from '@lucide/svelte/icons/folder-input';
import Pause from '@lucide/svelte/icons/pause';
import Square from '@lucide/svelte/icons/square';
import SquareArrowUpRight from '@lucide/svelte/icons/square-arrow-up-right';
import {
	type MoveSandbox,
	PlacementKind,
	type Sandbox,
	SandboxPlacementErrorCode,
	SystemExposureService,
	WhenMachineUnavailable,
} from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { MediaQuery } from 'svelte/reactivity';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { requestSandboxSystemAccess } from '#lib/api/sandboxes/exposure.ts';
import {
	deleteSandboxMutationOptions,
	moveSandboxMutationOptions,
	type SandboxLifecycleAction,
	sandboxActionMutationOptions,
	startSandboxMutationOptions,
} from '#lib/api/sandboxes/sandboxes.ts';
import Play from '#lib/components/icons/play.svelte';
import Redo from '#lib/components/icons/redo.svelte';
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	type PlacementError,
	placementError,
} from '#lib/features/sandboxes/lib/placement-errors.ts';
import {
	ACTION_REQUESTED_MESSAGES,
	primaryLifecycleAction,
	type SandboxHeaderAction,
} from '#lib/features/sandboxes/lib/sandbox-detail-actions.ts';
import { sandboxDetailTabs } from '#lib/features/sandboxes/lib/sandbox-detail-tabs.ts';
import {
	canDeleteSandbox,
	canRunSandboxLifecycleAction,
} from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { openResolvedUrlInNewTab } from '#lib/utils/open-new-tab.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';

function machineUnavailable(
	error: Error,
	failureMessage: string
): PlacementError | null {
	const placement = placementError(error);
	if (placement?.kind === SandboxPlacementErrorCode.MachineUnavailable) {
		return placement;
	}
	showApiError(error, failureMessage);
	return null;
}

function openBuildLogs(target: Sandbox): Promise<void> {
	return openResolvedUrlInNewTab(
		async () => {
			const access = await requestSandboxSystemAccess(
				target,
				SystemExposureService.BuildLogs
			);
			return access.url;
		},
		(error) => showApiError(error, 'Failed to open sandbox build logs')
	);
}

export class SandboxDetailActions {
	readonly #detail = getSandboxDetail();
	readonly #isDesktop = new MediaQuery(breakpointQuery('lg'));
	readonly #lifecycle = createMutation(() =>
		sandboxActionMutationOptions(this.#detail.sandboxId)
	);

	readonly sandboxesHref = resolve(Path.SANDBOXES);
	readonly sandboxesCrumb = {
		label: 'Sandboxes',
		href: this.sandboxesHref,
		icon: TerminalWindow,
	};
	readonly startMutation = createMutation(() => ({
		...startSandboxMutationOptions(this.#detail.sandboxId),
		onMutate: () => {
			this.startFailure = null;
		},
		onError: (error: Error) => {
			this.startFailure = machineUnavailable(
				error,
				'Failed to start the sandbox'
			);
		},
	}));
	readonly moveMutation = createMutation(() => ({
		...moveSandboxMutationOptions(this.#detail.sandboxId),
		onMutate: () => {
			this.moveFailure = null;
		},
		onError: (error: Error) => {
			this.moveFailure = machineUnavailable(
				error,
				'Failed to move the sandbox'
			);
		},
	}));
	readonly removeMutation = createMutation(() =>
		deleteSandboxMutationOptions()
	);

	moveOpen = $state(false);
	deleteOpen = $state(false);
	startFailure = $state.raw<PlacementError | null>(null);
	moveFailure = $state.raw<PlacementError | null>(null);

	readonly sandbox = $derived(this.#detail.query.data);
	readonly deleteTarget = $derived(
		this.deleteOpen ? (this.sandbox ?? null) : null
	);
	readonly tabs = $derived(
		sandboxDetailTabs(
			this.#detail.sandboxId,
			this.#detail.canWrite,
			this.#isDesktop.current,
			page.route.id
		)
	);
	readonly #primaryAction = $derived(
		this.sandbox && this.#detail.canWrite
			? primaryLifecycleAction(this.sandbox)
			: null
	);
	readonly headerActions = $derived.by((): HeaderAction[] => {
		const sandbox = this.sandbox;
		if (!sandbox) return [];
		const pending = this.#detail.pending;
		return [
			{
				id: 'refresh',
				label: 'Refresh',
				icon: Redo,
				disabled: this.#detail.query.isFetching,
				onSelect: () => void this.#detail.refresh(),
			},
			{
				id: 'build-logs',
				label: 'Build logs',
				icon: SquareArrowUpRight,
				visible: Boolean(sandbox.buildInfo?.snapshotRef),
				onSelect: () => void openBuildLogs(sandbox),
			},
			{
				id: 'pause',
				label: 'Pause',
				icon: Pause,
				visible: this.#canRun(sandbox, 'pause'),
				disabled: pending,
				onSelect: this.#runAction('pause'),
			},
			{
				id: 'stop',
				label: 'Stop',
				icon: Square,
				visible: this.#primaryAction === 'stop',
				disabled: pending,
				onSelect: this.#runAction('stop'),
			},
			{
				id: 'recover',
				kind: 'primary',
				label: 'Recover',
				icon: Redo,
				visible: this.#primaryAction === 'recover',
				disabled: pending,
				onSelect: this.#runAction('recover'),
			},
			{
				id: 'start',
				kind: 'primary',
				label: 'Start',
				icon: Play,
				visible: this.#primaryAction === 'start',
				disabled: pending || this.startMutation.isPending,
				pending: this.startMutation.isPending,
				pendingLabel: 'Starting...',
				onSelect: () => this.#startSandbox(sandbox),
			},
		];
	});
	readonly crumbActions = $derived.by((): ResourceRowAction[] => {
		const sandbox = this.sandbox;
		if (!sandbox) return [];
		const pending = this.#detail.pending;
		return [
			{
				label: 'Move',
				icon: FolderInput,
				visible: this.#detail.canWrite,
				disabled: pending || this.moveMutation.isPending,
				onSelect: () => {
					this.moveOpen = true;
				},
			},
			{
				label: 'Archive',
				icon: Archive,
				visible: this.#canRun(sandbox, 'archive'),
				disabled: pending,
				onSelect: this.#runAction('archive'),
			},
			{
				label: 'Copy ID',
				icon: Copy,
				onSelect: () => void navigator.clipboard.writeText(sandbox.id),
			},
			{
				label: 'Delete',
				icon: Trash,
				separated: true,
				visible: this.#detail.canDelete && canDeleteSandbox(sandbox),
				disabled: pending,
				onSelect: () => {
					this.deleteOpen = true;
				},
			},
		];
	});

	clearStartFailure = (): void => {
		this.startFailure = null;
	};

	changeStartChoiceOpen = (open: boolean): void => {
		if (!open) this.clearStartFailure();
	};

	changeMoveOpen = (open: boolean): void => {
		if (!open) this.moveFailure = null;
	};

	chooseStart = (whenMachineUnavailable: WhenMachineUnavailable): void => {
		this.startMutation.mutate(
			{ whenMachineUnavailable },
			{ onSuccess: this.clearStartFailure }
		);
	};

	move = (body: MoveSandbox): void => {
		this.moveMutation.mutate(body, {
			onSuccess: () => {
				this.moveOpen = false;
			},
		});
	};

	deleteSandbox = (sandbox: Sandbox): void => {
		this.removeMutation.mutate(sandbox, {
			onSuccess: (deleted) => {
				this.deleteOpen = false;
				toast.success(`Deleted ${deleted.name}`);
				void goto(this.sandboxesHref);
			},
		});
	};

	#canRun(target: Sandbox, action: SandboxLifecycleAction): boolean {
		return (
			this.#detail.canWrite && canRunSandboxLifecycleAction(target, action)
		);
	}

	#runAction(action: SandboxHeaderAction): () => void {
		return () =>
			this.#lifecycle.mutate(action, {
				onSuccess: () => toast.success(ACTION_REQUESTED_MESSAGES[action]),
			});
	}

	#startSandbox(target: Sandbox): void {
		this.startMutation.mutate(
			target.placement.kind === PlacementKind.Pinned
				? { whenMachineUnavailable: WhenMachineUnavailable.Fail }
				: {}
		);
	}
}
