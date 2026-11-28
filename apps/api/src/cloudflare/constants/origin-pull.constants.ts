/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CronExpression } from '@nestjs/schedule';
import {
	MILLISECONDS_PER_DAY,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';

export const ORIGIN_PULL_CERTIFICATE_AUTHORITY = {
	MOUNT: 'pki-origin-pull',
	ROLE: 'cloudflare-origin-pull',
	COMMON_NAME: 'cloudflare-origin-pull',
	TTL: '8760h',
	FORMAT: 'pem',
	PRIVATE_KEY_FORMAT: 'pkcs8',
} as const;

export const ORIGIN_PULL_RECONCILER = {
	expression: CronExpression.EVERY_10_MINUTES,
	name: 'reconcile-cloudflare-origin-pull',
	lockKey: 'reconcile-cloudflare-origin-pull',
	lockTtlSeconds: 5 * SECONDS_PER_MINUTE,
	renewBeforeMilliseconds: 30 * MILLISECONDS_PER_DAY,
} as const;

export const ORIGIN_PULL_CERTIFICATE_STATUS = {
	ACTIVE: 'active',
	INITIALIZING: 'initializing',
	PENDING_DEPLOYMENT: 'pending_deployment',
	PENDING_DELETION: 'pending_deletion',
	DELETED: 'deleted',
} as const;
