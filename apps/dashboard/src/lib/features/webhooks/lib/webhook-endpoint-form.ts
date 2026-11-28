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
	type WebhookEndpoint,
	WebhookSubscribableEventType,
} from '@snapflow/api-client';
import * as z from 'zod';
import { WEBHOOK_EVENT_TYPES } from './webhook-events.ts';

export const WEBHOOK_URL_MAX_LENGTH = 2_048;
export const WEBHOOK_DESCRIPTION_MAX_LENGTH = 512;

export const webhookEndpointFormSchema = z.object({
	url: z
		.string()
		.trim()
		.min(1, 'URL is required')
		.max(
			WEBHOOK_URL_MAX_LENGTH,
			`URL must be ${WEBHOOK_URL_MAX_LENGTH} characters or fewer`
		)
		.pipe(z.url({ message: 'Enter a valid URL' })),
	description: z
		.string()
		.trim()
		.max(
			WEBHOOK_DESCRIPTION_MAX_LENGTH,
			`Description must be ${WEBHOOK_DESCRIPTION_MAX_LENGTH} characters or fewer`
		),
	eventTypes: z
		.array(z.enum(WebhookSubscribableEventType))
		.min(1, 'Select at least one event'),
});

export type WebhookEndpointFormValues = z.infer<
	typeof webhookEndpointFormSchema
>;

export function webhookEndpointFormValues(
	endpoint: WebhookEndpoint | null
): WebhookEndpointFormValues {
	return {
		url: endpoint?.url ?? '',
		description: endpoint?.description ?? '',
		eventTypes: endpoint ? [...endpoint.eventTypes] : [...WEBHOOK_EVENT_TYPES],
	};
}

export function toWebhookEndpointBody(
	values: WebhookEndpointFormValues
): CreateWebhookEndpoint {
	return {
		url: values.url.trim(),
		description: values.description.trim(),
		eventTypes: values.eventTypes,
	};
}
