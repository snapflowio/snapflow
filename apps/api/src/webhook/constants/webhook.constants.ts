/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CronExpression } from '@nestjs/schedule';
import { ORGANIZATION_ROLE } from '@snapflow/organization-access';
import {
	SECONDS_PER_DAY,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';

export const WEBHOOK_LIMITS = {
	URL_MAX_LENGTH: 2_048,
	DESCRIPTION_MAX_LENGTH: 512,
	ENDPOINTS_PER_ORGANIZATION: 50,
	RESPONSE_BODY_MAX_BYTES: 4 * 1_024,
	ERROR_MAX_LENGTH: 2_000,
	SECRET_BYTES: 24,
} as const;

export const WEBHOOK_RETRY_DELAYS_SECONDS: readonly number[] = [
	5,
	5 * SECONDS_PER_MINUTE,
	30 * SECONDS_PER_MINUTE,
	2 * SECONDS_PER_HOUR,
	5 * SECONDS_PER_HOUR,
	10 * SECONDS_PER_HOUR,
	10 * SECONDS_PER_HOUR,
];

export const WEBHOOK_RETRY_JITTER_RATIO = 0.1;

export const WEBHOOK_MAXIMUM_SCHEDULED_ATTEMPTS =
	WEBHOOK_RETRY_DELAYS_SECONDS.length + 1;

export const WEBHOOK_SECRET_PREFIX = 'whsec_';
export const WEBHOOK_SECRET_ENCODING = 'base64';
export const WEBHOOK_SECRET_ROTATION_GRACE_SECONDS = SECONDS_PER_DAY;
export const WEBHOOK_SECRET_VERSION_INITIAL = 1;
export const WEBHOOK_SIGNATURE_SEPARATOR = ' ';

export const WEBHOOK_HEADER = {
	ID: 'webhook-id',
	TIMESTAMP: 'webhook-timestamp',
	SIGNATURE: 'webhook-signature',
	CONTENT_TYPE: 'content-type',
	USER_AGENT: 'user-agent',
} as const;

export const WEBHOOK_CONTENT_TYPE = 'application/json';
export const WEBHOOK_USER_AGENT = 'Snapflow-Webhooks/1.0';
export const WEBHOOK_HTTP_METHOD = 'POST';
export const WEBHOOK_SUCCESS_STATUS = { MINIMUM: 200, MAXIMUM: 299 } as const;

export const WEBHOOK_PROTOCOL = {
	HTTPS: 'https:',
	HTTP: 'http:',
} as const;

export const WEBHOOK_DISPATCH = {
	pollExpression: CronExpression.EVERY_SECOND,
	jobName: 'dispatch-webhook-deliveries',
	batchSize: 50,
	leaseMarginSeconds: 30,
	failureBackoffSeconds: 60,
} as const;

export const WEBHOOK_DISABLED_NOTICE = {
	expression: CronExpression.EVERY_MINUTE,
	jobName: 'send-webhook-disabled-notices',
	batchSize: 50,
	recipientRoles: [ORGANIZATION_ROLE.OWNER, ORGANIZATION_ROLE.ADMIN],
	dashboardPath: '/settings/webhooks',
	noticeKeyPrefix: 'webhook-endpoint-disabled',
} as const;

export const WEBHOOK_RETENTION = {
	expression: CronExpression.EVERY_HOUR,
	jobName: 'prune-webhook-messages',
	batchSize: 1_000,
} as const;

export const WEBHOOK_PROBLEM_CODE = {
	ENDPOINT_NOT_FOUND: 'webhook_endpoint_not_found',
	DELIVERY_NOT_FOUND: 'webhook_delivery_not_found',
	ENDPOINT_LIMIT_REACHED: 'webhook_endpoint_limit_reached',
	ENDPOINT_DISABLED: 'webhook_endpoint_disabled',
	DELIVERY_IN_FLIGHT: 'webhook_delivery_in_flight',
	URL_REJECTED: 'webhook_url_rejected',
} as const;
