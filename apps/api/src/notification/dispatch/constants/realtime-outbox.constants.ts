/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const RealtimeOutboxStatus = {
	PENDING: 'pending',
	PROCESSING: 'processing',
	PUBLISHED: 'published',
	FAILED: 'failed',
} as const;

export type RealtimeOutboxStatus =
	(typeof RealtimeOutboxStatus)[keyof typeof RealtimeOutboxStatus];

export const REALTIME_OUTBOX = {
	backoffBaseSeconds: 2,
	batchSize: 100,
	claimSeconds: 30,
	maximumAttempts: 10,
	maximumBackoffSeconds: 300,
	maximumStoredErrorLength: 2_000,
	pollExpression: '*/1 * * * * *',
} as const;
