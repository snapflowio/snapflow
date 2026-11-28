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
import DatabaseBackup from '@lucide/svelte/icons/database-backup';
import FolderInput from '@lucide/svelte/icons/folder-input';
import GitFork from '@lucide/svelte/icons/git-fork';
import ImageUp from '@lucide/svelte/icons/image-up';
import ListTree from '@lucide/svelte/icons/list-tree';
import Maximize2 from '@lucide/svelte/icons/maximize-2';
import Pause from '@lucide/svelte/icons/pause';
import Square from '@lucide/svelte/icons/square';
import SquareArrowUpRight from '@lucide/svelte/icons/square-arrow-up-right';
import {
	type MoveSandbox,
	type Sandbox,
	SandboxPlacementErrorCode,
	SandboxState,
	SystemExposureService,
} from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { createContext } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { requestSandboxSystemAccess } from '#lib/api/sandboxes/exposure.ts';
import {
	deleteSandboxMutationOptions,
	moveSandboxMutationOptions,
	type SandboxLifecycleAction,
	sandboxActionMutationOptions,
} from '#lib/api/sandboxes/sandboxes.ts';
import Play from '#lib/components/icons/play.svelte';
import Redo from '#lib/components/icons/redo.svelte';
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { copyWithToast } from '#lib/components/ui/clipboard/copy-with-toast.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import type { SandboxActionRequest } from '#lib/features/sandboxes/components/sandbox-action-confirm-modal.svelte';
import {
	type PlacementError,
	placementError,
} from '#lib/features/sandboxes/lib/placement-errors.ts';
import type { ConfigurationMode } from '#lib/features/sandboxes/lib/sandbox-configuration.ts';
import {
	ACTION_REQUESTED_MESSAGES,
	primaryLifecycleAction,
	type SandboxHeaderAction,
} from '#lib/features/sandboxes/lib/sandbox-detail-actions.ts';
import {
	isTerminalRoute,
	sandboxDetailTabs,
	TERMINAL_TAB_ROUTE,
} from '#lib/features/sandboxes/lib/sandbox-detail-tabs.ts';
import {
	canDeleteSandbox,
	canRunSandboxLifecycleAction,
	resizeBlockedReason,
	SANDBOX_ACTION_PENDING_REASON,
	SANDBOX_WRITE_PERMISSION_REASON,
} from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { SandboxRecovery } from '#lib/features/sandboxes/state/sandbox-recovery.svelte.ts';
import { SandboxStartFlow } from '#lib/features/sandboxes/state/sandbox-start-flow.svelte.ts';
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
	readonly startFlow = new SandboxStartFlow();
	readonly recovery = new SandboxRecovery();
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
	readonly removeMutation = createMutation(() => {
		const options = deleteSandboxMutationOptions();
		return { ...options, meta: { ...options.meta, failure: undefined } };
	});

	moveOpen = $state(false);
	deleteOpen = $state(false);
	confirmRequest = $state.raw<SandboxActionRequest | null>(null);
	moveFailure = $state.raw<PlacementError | null>(null);
	configurationMode = $state<ConfigurationMode | null>(null);
	configurationOpenCount = $state(0);
	tabActions = $state.raw<readonly HeaderAction[]>([]);

	readonly sandbox = $derived(this.#detail.query.data);
	readonly confirmPending = $derived(this.#lifecycle.isPending);
	readonly starting = $derived(
		this.startFlow.isStarting(this.#detail.sandboxId)
	);
	readonly deleteTarget = $derived(
		this.deleteOpen ? (this.sandbox ?? null) : null
	);
	readonly overviewInTabs = $derived(!this.#isDesktop.current);
	readonly tabs = $derived(
		sandboxDetailTabs({
			sandboxId: this.#detail.sandboxId,
			canWrite: this.#detail.canWrite,
			wide: this.#isDesktop.current,
			routeId: page.route.id,
			recoveryCount: this.#detail.forksQuery.data?.forks.length,
		})
	);
	readonly #primaryAction = $derived(
		this.sandbox && this.#detail.canWrite
			? primaryLifecycleAction(this.sandbox)
			: null
	);
	readonly #writeBlockedReason = $derived.by(() => {
		if (!this.#detail.canWrite) return SANDBOX_WRITE_PERMISSION_REASON;
		return this.#detail.pending ? SANDBOX_ACTION_PENDING_REASON : null;
	});
	readonly headerActions = $derived.by((): HeaderAction[] => {
		const sandbox = this.sandbox;
		if (!sandbox) return [];
		const pending = this.#detail.pending;
		const running =
			this.#detail.canWrite && sandbox.state === SandboxState.Started;
		return [
			...this.tabActions,
			{
				id: 'stop',
				label: 'Stop',
				icon: Square,
				visible: this.#primaryAction === 'stop',
				disabled: pending,
				disabledReason: SANDBOX_ACTION_PENDING_REASON,
				onSelect: () => this.#confirmAction('stop', sandbox),
			},
			{
				id: 'recover',
				kind: 'primary',
				label: 'Recover',
				icon: Redo,
				visible: this.#primaryAction === 'recover',
				disabled: pending,
				disabledReason: SANDBOX_ACTION_PENDING_REASON,
				onSelect: this.#runAction('recover'),
			},
			{
				id: 'start',
				kind: 'primary',
				label: 'Start',
				icon: Play,
				visible: this.#primaryAction === 'start',
				disabled: pending || this.starting,
				disabledReason: SANDBOX_ACTION_PENDING_REASON,
				pending: this.starting,
				onSelect: this.start,
			},
			{
				id: 'terminal',
				kind: this.tabActions.length > 0 ? 'secondary' : 'primary',
				label: 'Terminal',
				icon: TerminalWindow,
				visible: running && !isTerminalRoute(page.route.id),
				href: resolve(TERMINAL_TAB_ROUTE, { sandboxId: sandbox.id }),
			},
		];
	});
	readonly crumbActions = $derived.by((): ResourceRowAction[] => {
		const sandbox = this.sandbox;
		if (!sandbox) return [];
		const recovery = this.recovery;
		const writeBlocked = this.#writeBlockedReason;
		const resizeReason = writeBlocked ?? resizeBlockedReason(sandbox);
		const canDelete = this.#detail.canDelete && canDeleteSandbox(sandbox);
		return [
			{
				label: 'Pause',
				icon: Pause,
				visible: this.#canRun(sandbox, 'pause'),
				disabled: this.#detail.pending,
				disabledReason: SANDBOX_ACTION_PENDING_REASON,
				onSelect: this.#runAction('pause'),
			},
			{
				label: 'Create snapshot',
				icon: ImageUp,
				visible: this.#detail.canWrite,
				disabled: recovery.snapshotBlockedReason !== null,
				disabledReason: recovery.snapshotBlockedReason ?? undefined,
				onSelect: () => recovery.openNamedAction('snapshot'),
			},
			{
				label: 'Fork',
				icon: GitFork,
				visible: this.#detail.canWrite,
				disabled: recovery.forkBlockedReason !== null,
				disabledReason: recovery.forkBlockedReason ?? undefined,
				onSelect: () => recovery.openNamedAction('fork'),
			},
			{
				label: 'Back up',
				icon: DatabaseBackup,
				visible: this.#detail.canWrite,
				disabled:
					recovery.backupBlockedReason !== null ||
					recovery.backupMutation.isPending,
				disabledReason: recovery.backupBlockedReason ?? undefined,
				onSelect: () => recovery.backupMutation.mutate(),
			},
			{
				label: 'Resize',
				icon: Maximize2,
				visible: this.#detail.canWrite,
				disabled: resizeReason !== null,
				disabledReason: resizeReason ?? undefined,
				onSelect: () => this.configure('resources'),
			},
			{
				label: 'Move',
				icon: FolderInput,
				visible: this.#detail.canWrite,
				disabled: this.#detail.pending || this.moveMutation.isPending,
				disabledReason: SANDBOX_ACTION_PENDING_REASON,
				onSelect: () => {
					this.moveOpen = true;
				},
			},
			{
				label: 'Archive',
				icon: Archive,
				visible: this.#canRun(sandbox, 'archive'),
				disabled: this.#detail.pending,
				disabledReason: SANDBOX_ACTION_PENDING_REASON,
				onSelect: () => this.#confirmAction('archive', sandbox),
			},
			{
				label: 'Fork tree',
				icon: ListTree,
				separated: true,
				onSelect: () => void recovery.forkTree.open(),
			},
			{
				label: 'Build logs',
				icon: SquareArrowUpRight,
				visible: Boolean(sandbox.buildInfo?.snapshotRef),
				onSelect: () => void openBuildLogs(sandbox),
			},
			{
				label: 'Copy ID',
				icon: Copy,
				onSelect: () => void copyWithToast(sandbox.id, 'sandbox ID'),
			},
			{
				label: 'Delete',
				icon: Trash,
				destructive: true,
				visible: canDelete,
				disabled: this.#detail.pending,
				disabledReason: SANDBOX_ACTION_PENDING_REASON,
				onSelect: () => {
					this.deleteOpen = true;
				},
			},
			{
				label: 'Delete sandbox and forks',
				icon: Trash,
				destructive: true,
				visible:
					canDelete && (this.#detail.forksQuery.data?.forks.length ?? 0) > 0,
				disabled: this.#detail.pending,
				disabledReason: SANDBOX_ACTION_PENDING_REASON,
				onSelect: () => void recovery.recursiveDelete.open(),
			},
		];
	});

	start = (): void => {
		this.startFlow.start(this.#detail.sandboxId);
	};

	configure = (mode: ConfigurationMode): void => {
		this.configurationOpenCount += 1;
		this.configurationMode = mode;
	};

	closeConfirm = (): void => {
		this.confirmRequest = null;
	};

	runConfirmed = ({ action }: SandboxActionRequest): void => {
		if (action === 'delete' || action === 'start') return;
		this.#lifecycle.mutate(action, {
			onSuccess: () => {
				this.confirmRequest = null;
				toast.success(ACTION_REQUESTED_MESSAGES[action]);
			},
		});
	};

	changeMoveOpen = (open: boolean): void => {
		if (!open) this.moveFailure = null;
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

	#confirmAction(action: 'archive' | 'stop', target: Sandbox): void {
		this.confirmRequest = { action, targets: [target] };
	}
}

export const [getSandboxDetailActions, setSandboxDetailActions] =
	createContext<SandboxDetailActions>();
