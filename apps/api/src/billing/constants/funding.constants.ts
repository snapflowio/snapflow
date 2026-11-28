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
	SECONDS_PER_DAY,
	SECONDS_PER_HOUR,
} from '../../common/constants/time.constants';

export const RunwayWarning = {
	DAY: 'day',
	HOUR: 'hour',
} as const;

export type RunwayWarning = (typeof RunwayWarning)[keyof typeof RunwayWarning];

export const RUNWAY_WARNING_SECONDS = {
	[RunwayWarning.DAY]: SECONDS_PER_DAY,
	[RunwayWarning.HOUR]: SECONDS_PER_HOUR,
} as const satisfies Record<RunwayWarning, number>;

export const RUNWAY_WARNINGS_BY_URGENCY: readonly RunwayWarning[] = [
	RunwayWarning.HOUR,
	RunwayWarning.DAY,
];

export const FUNDING_POLICY = {
	startCoverageSeconds: SECONDS_PER_HOUR,
	unfundedArchiveRetentionDays: 7,
	archiveDeletionNoticeSeconds: SECONDS_PER_DAY,
	batchSize: 500,
	jobName: 'apply-organization-funding-policy',
	jobSchedule: CronExpression.EVERY_MINUTE,
	jobIntervalMinutes: 1,
	apiKeyBudgetWindowDays: 30,
} as const;

export const FundingEvents = {
	NOTICE: 'billing.funding.notice',
	API_KEY_BUDGET_EXHAUSTED: 'billing.funding.api-key-budget-exhausted',
} as const;

export const FundingNoticeKind = {
	RUNWAY_WARNING: 'runway_warning',
	COMPUTE_STOPPED: 'compute_stopped',
	ARCHIVE_DELETION_SCHEDULED: 'archive_deletion_scheduled',
	AUTO_TOP_UP_FAILED: 'auto_top_up_failed',
	SIGNER_EXPIRING: 'signer_expiring',
	SIGNER_EXPIRED: 'signer_expired',
	SIGNER_REVOKED: 'signer_revoked',
	SANDBOX_PAUSED_FOR_PAYMENT: 'sandbox_paused_for_payment',
} as const;

export type FundingNoticeKind =
	(typeof FundingNoticeKind)[keyof typeof FundingNoticeKind];
