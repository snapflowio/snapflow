/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	acceptSandboxLeaseRenewal,
	archiveSandbox,
	type CreateSandboxSnapshot,
	createBackup,
	createSandboxSnapshot,
	deleteSandbox,
	type ForkSandbox,
	forkSandbox,
	getSandboxAncestors,
	getSandboxForks,
	type ListSandboxesData,
	type MoveSandbox,
	moveSandbox,
	pauseSandbox,
	quoteSandbox,
	type ResizeSandbox,
	recoverSandbox,
	replaceLabels,
	resizeSandbox,
	type Sandbox,
	type SandboxLabels,
	type SandboxListItem,
	type SandboxQuoteRequest,
	type StartSandbox,
	setAutoArchiveInterval,
	setAutoDeleteInterval,
	setAutostopInterval,
	startSandbox,
	stopSandbox,
	type UpdateSandboxNetworkSettings,
	updateNetworkSettings,
	WhenMachineUnavailable,
} from '@snapflow/api-client';
import {
	createSandboxMutation,
	createSshAccessMutation,
	getSandboxBillingSummaryOptions,
	getSandboxLeaseOptions,
	getSandboxLeaseQueryKey,
	getSandboxOptions,
	listSandboxesOptions,
	listSandboxesQueryKey,
	revokeSshAccessMutation,
} from '@snapflow/api-client/svelte-query';
import {
	keepPreviousData,
	mutationOptions,
	type QueryKey,
	queryOptions,
} from '@tanstack/svelte-query';
import { idempotencyHeaders } from '#lib/api/client/api-client.ts';
import { collectCursorPages } from '#lib/api/client/cursor-pagination.ts';

const SANDBOX_REFRESH_INTERVAL_MILLISECONDS = 15_000;
const SANDBOX_QUOTE_QUERY_SCOPE = 'sandbox-quote';

export type SandboxLifecycleAction =
	| 'archive'
	| 'pause'
	| 'recover'
	| 'start'
	| 'stop';

export type SandboxBulkAction = SandboxLifecycleAction | 'delete';

export interface SandboxBulkResult {
	action: SandboxBulkAction;
	failed: number;
	succeeded: number;
}

const LIFECYCLE_REQUESTS = {
	archive: (sandboxIdOrName) => archiveSandbox({ path: { sandboxIdOrName } }),
	pause: (sandboxIdOrName) => pauseSandbox({ path: { sandboxIdOrName } }),
	recover: (sandboxIdOrName) => recoverSandbox({ path: { sandboxIdOrName } }),
	start: (sandboxIdOrName) =>
		startSandbox({
			path: { sandboxIdOrName },
			body: { whenMachineUnavailable: WhenMachineUnavailable.Fail },
		}),
	stop: (sandboxIdOrName) => stopSandbox({ path: { sandboxIdOrName } }),
} satisfies Record<
	SandboxLifecycleAction,
	(sandboxIdOrName: string) => Promise<unknown>
>;

export function deleteSandboxById(sandboxId: string) {
	return deleteSandbox({ path: { sandboxIdOrName: sandboxId } });
}

function runBulkAction(action: SandboxBulkAction, sandboxId: string) {
	return action === 'delete'
		? deleteSandboxById(sandboxId)
		: LIFECYCLE_REQUESTS[action](sandboxId);
}

export function sandboxQueryOptions(sandboxId: string) {
	return queryOptions({
		...getSandboxOptions({
			path: { sandboxIdOrName: sandboxId },
			query: { verbose: true },
		}),
		refetchInterval: SANDBOX_REFRESH_INTERVAL_MILLISECONDS,
	});
}

export function sandboxChangeQueryKeys(sandboxId: string): readonly QueryKey[] {
	return [sandboxQueryOptions(sandboxId).queryKey, listSandboxesQueryKey()];
}

const SANDBOX_ACTION_MUTATION_SCOPE = ['sandboxes', 'action'] as const;
const SANDBOX_ACTION_FAILURE = 'Sandbox action failed';
const SANDBOX_LEASE_REFRESH_INTERVAL_MILLISECONDS = 60_000;
const SANDBOX_BILLING_REFRESH_INTERVAL_MILLISECONDS = 15_000;

export interface SandboxLifecyclePolicy {
	autoArchive: number;
	autoDelete: number;
	autoStop: number;
}

export const sandboxActionMutationFilters = {
	mutationKey: SANDBOX_ACTION_MUTATION_SCOPE,
};

function sandboxActionOptions<TVariables>(
	sandboxId: string,
	mutationFn: (variables: TVariables) => Promise<unknown>,
	success?: string
) {
	return mutationOptions({
		mutationKey: [...SANDBOX_ACTION_MUTATION_SCOPE, sandboxId],
		mutationFn,
		meta: {
			failure: SANDBOX_ACTION_FAILURE,
			invalidates: sandboxChangeQueryKeys(sandboxId),
			success,
		},
	});
}

export function sandboxActionMutationOptions(sandboxId: string) {
	return sandboxActionOptions(sandboxId, (action: SandboxLifecycleAction) =>
		LIFECYCLE_REQUESTS[action](sandboxId)
	);
}

export function resizeSandboxMutationOptions(sandboxId: string) {
	return sandboxActionOptions(
		sandboxId,
		(body: ResizeSandbox) =>
			resizeSandbox({ path: { sandboxIdOrName: sandboxId }, body }),
		'Sandbox resize requested'
	);
}

export function sandboxLifecyclePolicyMutationOptions(sandboxId: string) {
	return sandboxActionOptions(
		sandboxId,
		({ autoArchive, autoDelete, autoStop }: SandboxLifecyclePolicy) =>
			Promise.all([
				setAutostopInterval({
					path: { sandboxIdOrName: sandboxId, interval: autoStop },
				}),
				setAutoArchiveInterval({
					path: { sandboxIdOrName: sandboxId, interval: autoArchive },
				}),
				setAutoDeleteInterval({
					path: { sandboxIdOrName: sandboxId, interval: autoDelete },
				}),
			]),
		'Lifecycle policy updated'
	);
}

export function sandboxLabelsMutationOptions(sandboxId: string) {
	return sandboxActionOptions(
		sandboxId,
		(body: SandboxLabels) =>
			replaceLabels({ path: { sandboxIdOrName: sandboxId }, body }),
		'Sandbox labels updated'
	);
}

export function sandboxNetworkPolicyMutationOptions(sandboxId: string) {
	return sandboxActionOptions(
		sandboxId,
		(body: UpdateSandboxNetworkSettings) =>
			updateNetworkSettings({ path: { sandboxIdOrName: sandboxId }, body }),
		'Network policy updated'
	);
}

export function forkSandboxMutationOptions(sandboxId: string) {
	return sandboxActionOptions(
		sandboxId,
		(body: ForkSandbox) =>
			forkSandbox({
				path: { sandboxIdOrName: sandboxId },
				body,
				headers: idempotencyHeaders(),
			}),
		'Sandbox fork created'
	);
}

export function sandboxSnapshotMutationOptions(sandboxId: string) {
	return sandboxActionOptions(
		sandboxId,
		(body: CreateSandboxSnapshot) =>
			createSandboxSnapshot({
				path: { sandboxIdOrName: sandboxId },
				body,
				headers: idempotencyHeaders(),
			}),
		'Snapshot creation started'
	);
}

export function collectSandboxForks(
	sandboxIdOrName: string,
	signal: AbortSignal
): Promise<Sandbox[]> {
	return collectCursorPages(
		async (cursor) =>
			(
				await getSandboxForks({
					path: { sandboxIdOrName },
					query: { cursor },
					signal,
				})
			).data
	);
}

export async function fetchSandboxAncestors(
	sandboxIdOrName: string,
	signal: AbortSignal
): Promise<Sandbox[]> {
	return (await getSandboxAncestors({ path: { sandboxIdOrName }, signal }))
		.data;
}

export function sandboxBackupMutationOptions(sandboxId: string) {
	return sandboxActionOptions(
		sandboxId,
		() =>
			createBackup({
				path: { sandboxIdOrName: sandboxId },
				headers: idempotencyHeaders(),
			}),
		'Backup creation started'
	);
}

export function moveSandboxMutationOptions(sandboxId: string) {
	return mutationOptions({
		mutationFn: (body: MoveSandbox) =>
			moveSandbox({ path: { sandboxIdOrName: sandboxId }, body }),
		meta: {
			invalidates: sandboxChangeQueryKeys(sandboxId),
			success: 'Sandbox move requested',
		},
	});
}

export function startSandboxMutationOptions(sandboxId: string) {
	return mutationOptions({
		mutationFn: (body: StartSandbox) =>
			startSandbox({ path: { sandboxIdOrName: sandboxId }, body }),
		meta: {
			invalidates: sandboxChangeQueryKeys(sandboxId),
			success: 'Sandbox start requested',
		},
	});
}

export function sandboxLeaseQueryOptions(sandboxId: string) {
	return queryOptions({
		...getSandboxLeaseOptions({ path: { sandboxIdOrName: sandboxId } }),
		refetchInterval: SANDBOX_LEASE_REFRESH_INTERVAL_MILLISECONDS,
		retry: false,
	});
}

export function acceptLeaseRenewalMutationOptions(sandboxId: string) {
	return mutationOptions({
		mutationFn: (priceCardId: string) =>
			acceptSandboxLeaseRenewal({
				path: { sandboxIdOrName: sandboxId },
				body: { priceCardId },
			}),
		meta: {
			invalidates: [
				getSandboxLeaseQueryKey({ path: { sandboxIdOrName: sandboxId } }),
				...sandboxChangeQueryKeys(sandboxId),
			],
			success: 'Renewed price accepted',
		},
	});
}

export function sandboxBillingSummaryQueryOptions(sandboxId: string) {
	return queryOptions({
		...getSandboxBillingSummaryOptions({ path: { sandboxId } }),
		refetchInterval: SANDBOX_BILLING_REFRESH_INTERVAL_MILLISECONDS,
	});
}

export function createSshAccessMutationOptions() {
	return mutationOptions({
		...createSshAccessMutation(),
		meta: {
			failure: 'Failed to create SSH access',
			success: 'Temporary SSH access created',
		},
	});
}

export function revokeSshAccessMutationOptions() {
	return mutationOptions({
		...revokeSshAccessMutation(),
		meta: {
			failure: 'Failed to revoke SSH access',
			success: 'SSH access revoked',
		},
	});
}

export function sandboxListQueryOptions(
	query: NonNullable<ListSandboxesData['query']>
) {
	return queryOptions({
		...listSandboxesOptions({ query }),
		placeholderData: keepPreviousData,
	});
}

export function sandboxLifecycleMutationOptions() {
	return mutationOptions({
		mutationFn: async ({
			action,
			sandbox,
		}: {
			action: SandboxLifecycleAction;
			sandbox: SandboxListItem;
		}) => {
			await LIFECYCLE_REQUESTS[action](sandbox.id);
			return action;
		},
		meta: {
			invalidates: [listSandboxesQueryKey()],
			failure: 'Failed to update sandbox',
		},
	});
}

export function sandboxBulkMutationOptions() {
	return mutationOptions({
		mutationFn: async ({
			action,
			sandboxes,
		}: {
			action: SandboxBulkAction;
			sandboxes: readonly SandboxListItem[];
		}): Promise<SandboxBulkResult> => {
			const results = await Promise.allSettled(
				sandboxes.map((sandbox) => runBulkAction(action, sandbox.id))
			);
			return {
				action,
				failed: results.filter((result) => result.status === 'rejected').length,
				succeeded: results.filter((result) => result.status === 'fulfilled')
					.length,
			};
		},
		meta: {
			invalidates: [listSandboxesQueryKey()],
			failure: 'Failed to update sandboxes',
		},
	});
}

export function deleteSandboxMutationOptions() {
	return mutationOptions({
		mutationFn: async (sandbox: SandboxListItem) => {
			await deleteSandboxById(sandbox.id);
			return sandbox;
		},
		meta: {
			invalidates: [listSandboxesQueryKey()],
			failure: 'Failed to delete sandbox',
		},
	});
}

export function createSandboxMutationOptions() {
	return mutationOptions({
		...createSandboxMutation(),
		meta: {
			success: 'Sandbox creation started',
			failure: 'Failed to create sandbox',
			invalidates: [listSandboxesQueryKey()],
		},
	});
}

export function sandboxQuoteQueryOptions(request: SandboxQuoteRequest | null) {
	return queryOptions({
		queryKey: [SANDBOX_QUOTE_QUERY_SCOPE, request] as const,
		queryFn: async ({ queryKey: [, body], signal }) => {
			if (!body) throw new Error('Sandbox quote request is not ready');
			return (await quoteSandbox({ body, signal })).data;
		},
		enabled: Boolean(request),
		retry: false,
	});
}
