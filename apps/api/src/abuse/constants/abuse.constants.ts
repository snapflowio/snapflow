/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CronExpression } from '@nestjs/schedule';
import { MILLISECONDS_PER_MINUTE } from '../../common/constants/time.constants';

export const AbuseSignalKind = {
	MINING_POOL_DNS: 'mining_pool_dns',
	MINING_POOL_CONNECTION: 'mining_pool_connection',
	STRATUM_HANDSHAKE: 'stratum_handshake',
	MINING_PROFILE: 'mining_profile',
	HORIZONTAL_SCAN: 'horizontal_scan',
	VERTICAL_SCAN: 'vertical_scan',
	FAILED_CONNECTIONS: 'failed_connections',
	BRUTE_FORCE: 'brute_force',
	SMTP_ATTEMPTS: 'smtp_attempts',
	CONNECTION_FLOOD: 'connection_flood',
	PACKET_FLOOD: 'packet_flood',
	REFLECTION_ATTEMPTS: 'reflection_attempts',
	PROXY_RELAY: 'proxy_relay',
} as const;
export type AbuseSignalKind =
	(typeof AbuseSignalKind)[keyof typeof AbuseSignalKind];

export const AbuseSignalSeverity = {
	SOFT: 'soft',
	HARD: 'hard',
} as const;
export type AbuseSignalSeverity =
	(typeof AbuseSignalSeverity)[keyof typeof AbuseSignalSeverity];

export const AbuseCaseStatus = {
	OBSERVED: 'observed',
	THROTTLED: 'throttled',
	SUSPENDED: 'suspended',
	RESOLVED: 'resolved',
} as const;
export type AbuseCaseStatus =
	(typeof AbuseCaseStatus)[keyof typeof AbuseCaseStatus];

export const ABUSE_THROTTLE = {
	bandwidthBps: 1_000_000,
	connectionsPerSecond: 5,
} as const;

const SUSPEND_AFTER_THROTTLED_MINUTES = 10;
const RELEASE_AFTER_QUIET_MINUTES = 30;

export const ABUSE_LADDER = {
	suspendAfterThrottledMilliseconds:
		SUSPEND_AFTER_THROTTLED_MINUTES * MILLISECONDS_PER_MINUTE,
	releaseAfterQuietMilliseconds:
		RELEASE_AFTER_QUIET_MINUTES * MILLISECONDS_PER_MINUTE,
	suspensionCleanupGracePeriodHours: 24,
} as const;

export const ABUSE_REPORT_LIMITS = {
	maximumSandboxes: 1_024,
	minimumFindings: 1,
	maximumFindings: 32,
	minimumCount: 1,
	maximumDetailLength: 2_048,
} as const;

export const ABUSE_THROTTLE_RELEASE_JOB = {
	expression: CronExpression.EVERY_MINUTE,
	name: 'release-abuse-throttles',
	lockKey: 'release-abuse-throttles',
	lockTtlSeconds: 60,
	batchSize: 100,
} as const;

export const AbuseErrorCode = {
	CASE_NOT_FOUND: 'abuse_case_not_found',
	CASE_RESOLVED: 'abuse_case_resolved',
} as const;

export const ABUSE_NOTICE_KEY_PREFIX = 'abuse';
