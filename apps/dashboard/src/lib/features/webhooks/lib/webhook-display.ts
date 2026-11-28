/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type WebhookDelivery,
	type WebhookDeliveryAttempt,
	WebhookDeliveryStatus,
	type WebhookDeliveryStatus as WebhookDeliveryStatusValue,
	type WebhookEndpoint,
	WebhookEndpointDisabledReason,
} from '@snapflow/api-client';
import * as z from 'zod';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';
import { relativeTimeLabel } from '#lib/features/organizations/lib/relative-time.ts';
import { WEBHOOK_EVENT_TYPES, webhookEventLabel } from './webhook-events.ts';

const META_SEPARATOR = ' · ';
const ALL = 'all';
const STATUS_CLASS_DIVISOR = 100;
const ROOT_PATH = '/';
const NO_RESPONSE_LABEL = '—';
const NO_DELIVERIES_LABEL = 'no deliveries yet';
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_FRACTION_DIGITS = 1;

export const DELIVERY_PARAM = 'delivery';

export const HTTP_CLASSES = ['2xx', '3xx', '4xx', '5xx', 'none'] as const;
export type HttpClass = (typeof HTTP_CLASSES)[number];

export type DeliveryStatusFilter = WebhookDeliveryStatusValue | typeof ALL;
export type HttpClassFilter = HttpClass | typeof ALL;
export type EventFilter = string;

export interface StatusDisplay {
	label: string;
	shape: StatusRingShape;
	tone: StatusRingTone;
	live?: boolean;
}

export const webhookEndpointsSearchSchema = z.object({
	search: z.string().catch(''),
	create: z.stringbool().optional().catch(undefined),
});

export const webhookDeliveriesSearchSchema = z.object({
	status: z.enum([ALL, ...Object.values(WebhookDeliveryStatus)]).catch(ALL),
	http: z.enum([ALL, ...HTTP_CLASSES]).catch(ALL),
	event: z.enum([ALL, ...WEBHOOK_EVENT_TYPES]).catch(ALL),
});

const DELIVERY_STATUS_LABEL: Record<WebhookDeliveryStatusValue, string> = {
	[WebhookDeliveryStatus.Pending]: 'Retrying',
	[WebhookDeliveryStatus.Succeeded]: 'Delivered',
	[WebhookDeliveryStatus.Failed]: 'Failed',
};

const HTTP_CLASS_LABEL: Record<HttpClass, string> = {
	'2xx': '2xx',
	'3xx': '3xx',
	'4xx': '4xx',
	'5xx': '5xx',
	none: 'No response',
};

export const DELIVERY_STATUS_FILTER_OPTIONS: readonly ChipOption<DeliveryStatusFilter>[] =
	[
		{ value: ALL, label: 'All statuses' },
		...Object.values(WebhookDeliveryStatus).map((status) => ({
			value: status,
			label: DELIVERY_STATUS_LABEL[status],
		})),
	];

export const HTTP_CLASS_FILTER_OPTIONS: readonly ChipOption<HttpClassFilter>[] =
	[
		{ value: ALL, label: 'All responses' },
		...HTTP_CLASSES.map((httpClass) => ({
			value: httpClass,
			label: HTTP_CLASS_LABEL[httpClass],
		})),
	];

export function eventFilterOptions(
	eventTypes: readonly string[]
): ChipOption<EventFilter>[] {
	return [
		{ value: ALL, label: 'All events' },
		...eventTypes.map((type) => ({
			value: type,
			label: webhookEventLabel(type),
		})),
	];
}

export function deliveryStatusFilterValue(
	filter: DeliveryStatusFilter
): WebhookDeliveryStatusValue | undefined {
	return filter === ALL ? undefined : filter;
}

export function httpClassOf(status: number | null): HttpClass {
	if (status === null) return 'none';
	const statusClass = Math.floor(status / STATUS_CLASS_DIVISOR);
	return (
		HTTP_CLASSES.find((httpClass) =>
			httpClass.startsWith(String(statusClass))
		) ?? 'none'
	);
}

export function matchesDeliveryFilters(
	delivery: WebhookDelivery,
	http: HttpClassFilter,
	event: EventFilter
): boolean {
	return (
		(http === ALL || httpClassOf(delivery.lastResponseStatus) === http) &&
		(event === ALL || delivery.eventType === event)
	);
}

export function deliveriesFiltered(
	status: DeliveryStatusFilter,
	http: HttpClassFilter,
	event: EventFilter
): boolean {
	return status !== ALL || http !== ALL || event !== ALL;
}

export const CLEARED_DELIVERY_FILTERS = {
	status: ALL,
	http: ALL,
	event: ALL,
} as const;

export function deliveryStatusDisplay(
	delivery: WebhookDelivery
): StatusDisplay {
	switch (delivery.status) {
		case WebhookDeliveryStatus.Succeeded:
			return {
				label: DELIVERY_STATUS_LABEL.succeeded,
				shape: 'check',
				tone: 'success',
			};
		case WebhookDeliveryStatus.Failed:
			return {
				label: DELIVERY_STATUS_LABEL.failed,
				shape: 'cross',
				tone: 'error',
			};
		default:
			return delivery.attempts === 0
				? { label: 'Queued', shape: 'dashed', tone: 'neutral', live: true }
				: {
						label: DELIVERY_STATUS_LABEL.pending,
						shape: 'half',
						tone: 'warning',
						live: true,
					};
	}
}

export function responseCodeLabel(status: number | null): string {
	return status === null ? NO_RESPONSE_LABEL : String(status);
}

export function endpointStatusDisplay(
	endpoint: WebhookEndpoint
): StatusDisplay {
	if (endpoint.enabled) {
		return endpoint.failingSince
			? { label: 'Failing', shape: 'alert', tone: 'warning' }
			: { label: 'Enabled', shape: 'check', tone: 'success' };
	}
	return endpoint.disabledReason === WebhookEndpointDisabledReason.Failing
		? { label: 'Stopped', shape: 'cross', tone: 'error' }
		: { label: 'Disabled', shape: 'paused', tone: 'neutral' };
}

export function endpointStoppedForFailures(endpoint: WebhookEndpoint): boolean {
	return (
		!endpoint.enabled &&
		endpoint.disabledReason === WebhookEndpointDisabledReason.Failing
	);
}

export interface EndpointAddress {
	host: string;
	path: string;
}

export function endpointAddress(endpoint: WebhookEndpoint): EndpointAddress {
	try {
		const url = new URL(endpoint.url);
		const path = `${url.pathname === ROOT_PATH ? '' : url.pathname}${url.search}`;
		return { host: url.host, path };
	} catch {
		return { host: endpoint.url, path: '' };
	}
}

function endpointHealth(endpoint: WebhookEndpoint): string {
	if (endpoint.failingSince) {
		return `Failing since ${relativeTimeLabel(endpoint.failingSince)}`;
	}
	if (endpoint.lastSucceededAt) {
		return `last delivery ${relativeTimeLabel(endpoint.lastSucceededAt)}`;
	}
	return NO_DELIVERIES_LABEL;
}

export function endpointMeta(endpoint: WebhookEndpoint): string {
	const { path } = endpointAddress(endpoint);
	const events =
		endpoint.eventTypes.length === 1
			? webhookEventLabel(endpoint.eventTypes[0] ?? '')
			: `${endpoint.eventTypes.length} events`;
	return [path, events, endpointHealth(endpoint)]
		.filter((part) => part.length > 0)
		.join(META_SEPARATOR);
}

export function matchesEndpoint(
	endpoint: WebhookEndpoint,
	search: string
): boolean {
	return (
		!search ||
		endpoint.url.toLowerCase().includes(search) ||
		(endpoint.description?.toLowerCase().includes(search) ?? false)
	);
}

export function attemptSummary(attempt: WebhookDeliveryAttempt): string {
	const seconds = (
		attempt.durationMilliseconds / MILLISECONDS_PER_SECOND
	).toFixed(SECONDS_FRACTION_DIGITS);
	return [responseCodeLabel(attempt.responseStatus), `${seconds}s`].join(
		META_SEPARATOR
	);
}

export function deleteEndpointCopy(
	endpoint: WebhookEndpoint | null
): ChipConfirmCopy {
	return {
		title: 'Delete webhook endpoint',
		text: [
			'Deliveries to ',
			{ text: endpoint?.url ?? 'this endpoint', bold: true },
			' stop and its delivery log is removed. ',
			{ text: "This can't be undone.", error: true },
		],
		confirmLabel: 'Delete',
	};
}
