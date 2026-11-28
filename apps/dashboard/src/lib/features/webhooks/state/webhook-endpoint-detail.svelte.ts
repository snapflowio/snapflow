/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Pencil from '@lucide/svelte/icons/pencil';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import Send from '@lucide/svelte/icons/send';
import type { WebhookDelivery } from '@snapflow/api-client';
import {
	createInfiniteQuery,
	createMutation,
	createQuery,
	keepPreviousData,
} from '@tanstack/svelte-query';
import {
	allWebhookEndpointsQueryOptions,
	resendWebhookDeliveryMutationOptions,
	webhookDeliveriesInfiniteQueryOptions,
} from '#lib/api/webhooks.ts';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import {
	CLEARED_DELIVERY_FILTERS,
	DELIVERY_PARAM,
	type DeliveryStatusFilter,
	deliveriesFiltered,
	deliveryStatusFilterValue,
	type EventFilter,
	type HttpClassFilter,
	matchesDeliveryFilters,
	webhookDeliveriesSearchSchema,
} from '#lib/features/webhooks/lib/webhook-display.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { goto } from '$app/navigation';
import { WebhookEndpointActions } from './webhook-endpoint-actions.svelte.ts';

const ENABLE_FIRST_REASON = 'Enable the endpoint to send a test event';

function createDeliveriesQuery(
	endpointId: () => string,
	statusFilter: () => DeliveryStatusFilter
) {
	return createInfiniteQuery(() => ({
		...webhookDeliveriesInfiniteQueryOptions(
			endpointId(),
			deliveryStatusFilterValue(statusFilter())
		),
		initialPageParam: { path: { endpointId: endpointId() } },
		getNextPageParam: (lastPage: { nextCursor: string | null }) =>
			lastPage.nextCursor ?? undefined,
		placeholderData: keepPreviousData,
	}));
}

function createResendMutation(endpointId: () => string) {
	return createMutation(() =>
		resendWebhookDeliveryMutationOptions(endpointId())
	);
}

export class WebhookEndpointDetail {
	readonly #endpointId: () => string;
	readonly #params = new SearchParams(webhookDeliveriesSearchSchema);

	readonly endpointsQuery = createQuery(() =>
		allWebhookEndpointsQueryOptions()
	);
	readonly actions: WebhookEndpointActions;

	readonly statusFilter: DeliveryStatusFilter = $derived(
		this.#params.current.status
	);
	readonly httpFilter: HttpClassFilter = $derived(this.#params.current.http);
	readonly eventFilter: EventFilter = $derived(this.#params.current.event);
	readonly filtered = $derived(
		deliveriesFiltered(this.statusFilter, this.httpFilter, this.eventFilter)
	);

	readonly deliveriesQuery: ReturnType<typeof createDeliveriesQuery>;
	readonly resendMutation: ReturnType<typeof createResendMutation>;

	readonly endpoint = $derived(
		this.endpointsQuery.data?.find(
			(endpoint) => endpoint.id === this.#endpointId()
		) ?? null
	);
	readonly deliveries: readonly WebhookDelivery[] = $derived.by(() =>
		(
			this.deliveriesQuery.data?.pages.flatMap((page) => page.items) ?? []
		).filter((delivery) =>
			matchesDeliveryFilters(delivery, this.httpFilter, this.eventFilter)
		)
	);
	readonly panel = new OpenRowParam(
		() => this.deliveries,
		(delivery) => delivery.id,
		{ param: DELIVERY_PARAM }
	);

	readonly headerActions = $derived.by((): HeaderAction[] => {
		const endpoint = this.endpoint;
		if (!endpoint) return [];
		return [
			{
				id: 'rotate',
				label: 'Rotate secret',
				icon: RefreshCw,
				visible: this.actions.canWrite,
				onSelect: () => (this.actions.rotating = endpoint),
			},
			{
				id: 'edit',
				label: 'Edit',
				icon: Pencil,
				visible: this.actions.canWrite,
				onSelect: () => this.actions.openEdit(endpoint),
			},
			{
				id: 'delete',
				kind: 'delete',
				label: 'Delete',
				visible: this.actions.canDelete,
				onSelect: () => (this.actions.deleting = endpoint),
			},
			{
				id: 'test',
				kind: 'primary',
				label: 'Send test event',
				icon: Send,
				visible: this.actions.canWrite,
				disabled: !endpoint.enabled,
				disabledReason: endpoint.enabled ? undefined : ENABLE_FIRST_REASON,
				pending: this.actions.testMutation.isPending,
				onSelect: () => this.actions.sendTest(endpoint),
			},
		];
	});

	constructor(endpointId: () => string) {
		this.#endpointId = endpointId;
		this.deliveriesQuery = createDeliveriesQuery(
			endpointId,
			() => this.statusFilter
		);
		this.resendMutation = createResendMutation(endpointId);
		this.actions = new WebhookEndpointActions(
			endpointId,
			() => void goto(resolvePath(Path.SETTINGS_WEBHOOKS))
		);
	}

	changeStatusFilter = (status: DeliveryStatusFilter): void => {
		void this.#params.update({ status });
	};

	changeHttpFilter = (http: HttpClassFilter): void => {
		void this.#params.update({ http });
	};

	changeEventFilter = (event: EventFilter): void => {
		const parsed = webhookDeliveriesSearchSchema.shape.event.safeParse(event);
		if (parsed.success) void this.#params.update({ event: parsed.data });
	};

	clearFilters = (): void => {
		void this.#params.update(CLEARED_DELIVERY_FILTERS);
	};

	loadMore = (): void => {
		void this.deliveriesQuery.fetchNextPage();
	};

	refetch = (): void => {
		void this.deliveriesQuery.refetch();
	};

	resend = (delivery: WebhookDelivery): void => {
		this.resendMutation.mutate(delivery);
	};
}
