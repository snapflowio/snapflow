/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateWebhookEndpoint,
	createWebhookEndpoint,
	deleteWebhookEndpoint,
	listWebhookEndpoints,
	resendWebhookDelivery,
	rotateWebhookEndpointSecret,
	sendWebhookTestEvent,
	type UpdateWebhookEndpoint,
	updateWebhookEndpoint,
	type WebhookDelivery,
	type WebhookDeliveryStatus,
	type WebhookEndpoint,
} from '@snapflow/api-client';
import {
	listWebhookDeliveriesInfiniteOptions,
	listWebhookDeliveriesInfiniteQueryKey,
	listWebhookDeliveryAttemptsOptions,
	listWebhookEndpointsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';

const WEBHOOK_DELIVERY_PAGE_SIZE = 50;

export interface WebhookEndpointChange {
	endpoint: WebhookEndpoint;
	body: UpdateWebhookEndpoint;
}

function endpointPath(endpointId: string) {
	return { path: { endpointId } };
}

function deliveriesKey(endpointId: string) {
	return listWebhookDeliveriesInfiniteQueryKey(endpointPath(endpointId));
}

export function allWebhookEndpointsQueryOptions() {
	return allPagesOptions(
		listWebhookEndpointsQueryKey(),
		async (cursor, signal) =>
			(await listWebhookEndpoints({ query: { cursor }, signal })).data
	);
}

export function webhookDeliveriesInfiniteQueryOptions(
	endpointId: string,
	status: WebhookDeliveryStatus | undefined
) {
	return listWebhookDeliveriesInfiniteOptions({
		...endpointPath(endpointId),
		query: { limit: WEBHOOK_DELIVERY_PAGE_SIZE, status },
	});
}

export function webhookDeliveryAttemptsQueryOptions(
	delivery: Pick<WebhookDelivery, 'endpointId' | 'id'>
) {
	return listWebhookDeliveryAttemptsOptions({
		path: { endpointId: delivery.endpointId, deliveryId: delivery.id },
	});
}

export function createWebhookEndpointMutationOptions() {
	return mutationOptions({
		mutationFn: async (body: CreateWebhookEndpoint) =>
			(await createWebhookEndpoint({ body })).data,
		meta: {
			invalidates: [listWebhookEndpointsQueryKey()],
			success: 'Webhook endpoint created',
			failure: 'Failed to create webhook endpoint',
		},
	});
}

export function updateWebhookEndpointMutationOptions() {
	return mutationOptions({
		mutationFn: async ({ endpoint, body }: WebhookEndpointChange) =>
			(await updateWebhookEndpoint({ ...endpointPath(endpoint.id), body }))
				.data,
		meta: {
			invalidates: [listWebhookEndpointsQueryKey()],
			success: 'Webhook endpoint updated',
			failure: 'Failed to update webhook endpoint',
		},
	});
}

export function deleteWebhookEndpointMutationOptions() {
	return mutationOptions({
		mutationFn: (endpoint: WebhookEndpoint) =>
			deleteWebhookEndpoint(endpointPath(endpoint.id)),
		meta: {
			invalidates: [listWebhookEndpointsQueryKey()],
			success: 'Webhook endpoint deleted',
			failure: 'Failed to delete webhook endpoint',
		},
	});
}

export function rotateWebhookSecretMutationOptions() {
	return mutationOptions({
		mutationFn: async (endpoint: WebhookEndpoint) =>
			(await rotateWebhookEndpointSecret(endpointPath(endpoint.id))).data,
		meta: {
			invalidates: [listWebhookEndpointsQueryKey()],
			success: 'Signing secret rotated',
			failure: 'Failed to rotate the signing secret',
		},
	});
}

export function sendWebhookTestMutationOptions(
	viewedEndpointId: string | undefined
) {
	return mutationOptions({
		mutationFn: async (endpoint: WebhookEndpoint) =>
			(await sendWebhookTestEvent(endpointPath(endpoint.id))).data,
		meta: {
			invalidates: viewedEndpointId ? [deliveriesKey(viewedEndpointId)] : [],
			success: 'Test event sent',
			failure: 'Failed to send the test event',
		},
	});
}

export function resendWebhookDeliveryMutationOptions(endpointId: string) {
	return mutationOptions({
		mutationFn: async (delivery: WebhookDelivery) =>
			(
				await resendWebhookDelivery({
					path: { endpointId: delivery.endpointId, deliveryId: delivery.id },
				})
			).data,
		meta: {
			invalidates: [deliveriesKey(endpointId)],
			success: 'Delivery queued for another attempt',
			failure: 'Failed to resend the delivery',
		},
	});
}
