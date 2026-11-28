/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiErrorCode,
	SandboxPlacementErrorCode,
	WhenMachineUnavailable,
} from '@snapflow/api-client';
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { billingRestrictionNotice } from '#lib/api/errors/error-catalog.ts';
import {
	sandboxChangeQueryKeys,
	startSandboxMutationOptions,
} from '#lib/api/sandboxes/sandboxes.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	automaticPaymentsDescription,
	BILLING_FIX_LABELS,
	billingFixHref,
	PAYMENT_HOLD_COPY,
} from '#lib/features/billing/lib/billing-overview.ts';
import {
	BILLING_RESTRICTED_KIND,
	type PlacementError,
	placementError,
} from '#lib/features/sandboxes/lib/placement-errors.ts';
import { resolvePath } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';

const START_FAILURE = 'Failed to start the sandbox';

function handledPlacementError(error: unknown): PlacementError | null {
	const placement = placementError(error);
	return placement?.kind === SandboxPlacementErrorCode.MachineUnavailable ||
		placement?.kind === BILLING_RESTRICTED_KIND ||
		placement?.kind === ApiErrorCode.AutomaticPaymentsRequired
		? placement
		: null;
}

function showBillingRestriction(failure: PlacementError): void {
	if (failure.kind === ApiErrorCode.AutomaticPaymentsRequired) {
		const copy = PAYMENT_HOLD_COPY[failure.reason];
		toast.warning(copy.title, {
			description: automaticPaymentsDescription(failure),
			action: {
				label: BILLING_FIX_LABELS[copy.fix],
				onClick: () => void goto(billingFixHref(copy.fix)),
			},
		});
		return;
	}
	if (failure.kind !== BILLING_RESTRICTED_KIND) return;
	const notice = billingRestrictionNotice(failure.code);
	toast.warning(notice.title, {
		description: notice.message,
		action: {
			label: notice.action.label,
			to: resolvePath(notice.action.path),
		},
	});
}

export class SandboxStartFlow {
	readonly #queryClient = useQueryClient();
	#sandboxId = $state<string | null>(null);
	failure = $state.raw<PlacementError | null>(null);

	readonly mutation = createMutation(() => {
		const options = startSandboxMutationOptions();
		return {
			...options,
			meta: {
				...options.meta,
				failure: (error: unknown) =>
					handledPlacementError(error) ? undefined : START_FAILURE,
			},
			onMutate: () => {
				this.failure = null;
			},
			onError: (error: Error) => {
				const failure = handledPlacementError(error);
				if (failure?.kind === SandboxPlacementErrorCode.MachineUnavailable) {
					this.failure = failure;
				} else if (failure) {
					showBillingRestriction(failure);
				}
			},
			onSettled: (_data, _error, { sandboxId }) =>
				Promise.all(
					sandboxChangeQueryKeys(sandboxId).map((queryKey) =>
						this.#queryClient.invalidateQueries({ queryKey })
					)
				),
		};
	});

	readonly choiceOpen = $derived(this.failure !== null);

	isStarting = (sandboxId: string): boolean =>
		this.mutation.isPending && this.#sandboxId === sandboxId;

	start = (sandboxId: string): void => {
		this.#sandboxId = sandboxId;
		this.mutation.mutate({
			sandboxId,
			body: { whenMachineUnavailable: WhenMachineUnavailable.Fail },
		});
	};

	choose = (whenMachineUnavailable: WhenMachineUnavailable): void => {
		const sandboxId = this.#sandboxId;
		if (!sandboxId) return;
		this.mutation.mutate(
			{ sandboxId, body: { whenMachineUnavailable } },
			{ onSuccess: this.clearFailure }
		);
	};

	clearFailure = (): void => {
		this.failure = null;
	};

	changeChoiceOpen = (open: boolean): void => {
		if (!open) this.clearFailure();
	};
}
