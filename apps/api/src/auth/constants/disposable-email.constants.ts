/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CronExpression } from '@nestjs/schedule';

export const DISPOSABLE_EMAIL_BLOCKLIST = {
	sourceUrl:
		'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf',
	domainsKey: 'auth:disposable-email-domains',
	stagingKey: 'auth:disposable-email-domains:staging',
	etagKey: 'auth:disposable-email-domains:etag',
	requestTimeoutMilliseconds: 30_000,
	minimumDomains: 1_000,
	commentPrefix: '#',
	domainSeparator: '.',
	addressSeparator: '@',
} as const;

export const DISPOSABLE_EMAIL_REFRESH_JOB = {
	expression: CronExpression.EVERY_6_HOURS,
	name: 'refresh-disposable-email-domains',
} as const;
