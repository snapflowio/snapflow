/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { WebhookEventType } from '../enums/webhook-event-type.enum';

type WebhookDataValue = string | number | boolean | null;

type WebhookEventData = Readonly<Record<string, WebhookDataValue>>;

export interface WebhookPayload {
	type: WebhookEventType;
	timestamp: string;
	data: WebhookEventData;
}

export interface WebhookPublication {
	organizationId: string;
	type: WebhookEventType;
	data: WebhookEventData;
	deduplicationKey: string;
}
