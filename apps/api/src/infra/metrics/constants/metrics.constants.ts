/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const METRICS_ENDPOINT = {
	host: '0.0.0.0',
	path: '/metrics',
} as const;

export const SNAPFLOW_METER_NAME = 'snapflow';

export const METRIC_NAME = {
	SCHEDULED_JOB_RUNS: 'snapflow.scheduled_job.runs',
	SCHEDULED_JOB_DURATION: 'snapflow.scheduled_job.duration',
	EMAIL_SENDS: 'snapflow.email.sends',
	REALTIME_OUTBOX_EVENTS: 'snapflow.realtime_outbox.events',
	REALTIME_OUTBOX_OLDEST_PENDING_AGE:
		'snapflow.realtime_outbox.oldest_pending_age',
	ABUSE_REPORTS_OPEN: 'snapflow.abuse_reports.open',
	ABUSE_REPORTS_OVERDUE: 'snapflow.abuse_reports.overdue',
	ABUSE_COUNTER_NOTICES_PAST_RESTORE_BY:
		'snapflow.abuse_counter_notices.past_restore_by',
	ABUSE_COUNTER_NOTICES_FORWARD_OVERDUE:
		'snapflow.abuse_counter_notices.forward_overdue',
	SETTLEMENT_CHAIN_IDENTITY_UNVERIFIED_AGE:
		'snapflow.settlement.chain_identity_unverified_age',
} as const;

export const METRIC_ATTRIBUTE = {
	JOB_NAME: 'job.name',
	OUTCOME: 'outcome',
	EMAIL_CATEGORY: 'email.category',
	OUTBOX_STATUS: 'outbox.status',
	ABUSE_CATEGORY: 'abuse.category',
} as const;

export const MetricOutcome = {
	SUCCESS: 'success',
	FAILURE: 'failure',
} as const;

export type MetricOutcome = (typeof MetricOutcome)[keyof typeof MetricOutcome];

export const METRIC_UNIT = {
	SECONDS: 's',
	EVENTS: '{event}',
	RUNS: '{run}',
	EMAILS: '{email}',
	REPORTS: '{report}',
} as const;

export const MILLISECONDS_PER_SECOND = 1_000;
