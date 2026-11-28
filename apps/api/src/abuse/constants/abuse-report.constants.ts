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
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';

export const AbuseReporterType = {
	PUBLIC: 'public',
	HOST: 'host',
	USER: 'user',
} as const;
export type AbuseReporterType =
	(typeof AbuseReporterType)[keyof typeof AbuseReporterType];

export const AbuseReportCategory = {
	PHISHING: 'phishing',
	MALWARE: 'malware',
	CSAM: 'csam',
	NON_CONSENSUAL_IMAGERY: 'non_consensual_imagery',
	COPYRIGHT: 'copyright',
	TRADEMARK: 'trademark',
	NETWORK_ABUSE: 'network_abuse',
	THREAT_TO_LIFE: 'threat_to_life',
	OTHER: 'other',
} as const;
export type AbuseReportCategory =
	(typeof AbuseReportCategory)[keyof typeof AbuseReportCategory];

export const AbuseReportStatus = {
	RECEIVED: 'received',
	ACKNOWLEDGED: 'acknowledged',
	MATCHED: 'matched',
	UNMATCHED: 'unmatched',
	IN_REVIEW: 'in_review',
	ACTIONED: 'actioned',
	NO_ACTION: 'no_action',
	REFERRED: 'referred',
	APPEALED: 'appealed',
	CLOSED: 'closed',
} as const;
export type AbuseReportStatus =
	(typeof AbuseReportStatus)[keyof typeof AbuseReportStatus];

export const ABUSE_REPORT_DECISIONS = [
	AbuseReportStatus.ACTIONED,
	AbuseReportStatus.NO_ACTION,
	AbuseReportStatus.REFERRED,
] as const;
export type AbuseReportDecision = (typeof ABUSE_REPORT_DECISIONS)[number];

export const APPEALABLE_REPORT_STATUSES = [
	AbuseReportStatus.MATCHED,
	AbuseReportStatus.IN_REVIEW,
	AbuseReportStatus.ACTIONED,
] as const;

export const SETTLED_REPORT_STATUSES = [
	AbuseReportStatus.NO_ACTION,
	AbuseReportStatus.CLOSED,
] as const;

export const ANONYMOUS_REPORT_CATEGORIES: ReadonlySet<AbuseReportCategory> =
	new Set([AbuseReportCategory.CSAM, AbuseReportCategory.THREAT_TO_LIFE]);

export const RESTRICTED_REPORT_CATEGORIES: ReadonlySet<AbuseReportCategory> =
	new Set([AbuseReportCategory.CSAM]);

const BUSINESS_DAY_HOURS = 24;

export const ISP_COMPLAINT_TARGET = 'isp_complaint';

export const ABUSE_RESPONSE_TARGET_HOURS: Readonly<
	Record<AbuseReportCategory | typeof ISP_COMPLAINT_TARGET, number>
> = {
	[AbuseReportCategory.CSAM]: 1,
	[AbuseReportCategory.THREAT_TO_LIFE]: 1,
	[AbuseReportCategory.PHISHING]: BUSINESS_DAY_HOURS,
	[AbuseReportCategory.MALWARE]: BUSINESS_DAY_HOURS,
	[ISP_COMPLAINT_TARGET]: BUSINESS_DAY_HOURS,
	[AbuseReportCategory.COPYRIGHT]: 2 * BUSINESS_DAY_HOURS,
	[AbuseReportCategory.TRADEMARK]: 3 * BUSINESS_DAY_HOURS,
	[AbuseReportCategory.NON_CONSENSUAL_IMAGERY]: 3 * BUSINESS_DAY_HOURS,
	[AbuseReportCategory.NETWORK_ABUSE]: 3 * BUSINESS_DAY_HOURS,
	[AbuseReportCategory.OTHER]: 3 * BUSINESS_DAY_HOURS,
};

export const AbuseHostnameKind = {
	PREVIEW: 'preview',
	ORIGIN: 'origin',
	CUSTOM_DOMAIN: 'custom_domain',
	PORT: 'port',
} as const;
export type AbuseHostnameKind =
	(typeof AbuseHostnameKind)[keyof typeof AbuseHostnameKind];

export const AbuseEvidenceKind = {
	SANDBOX_SNAPSHOT: 'sandbox_snapshot',
	CONNECTION_RECORDS: 'connection_records',
	PREVIEW_CAPTURE: 'preview_capture',
} as const;
export type AbuseEvidenceKind =
	(typeof AbuseEvidenceKind)[keyof typeof AbuseEvidenceKind];

export const AbuseCaseAction = {
	DISABLE_PREVIEW: 'disable_preview',
	BLOCK_EGRESS: 'block_egress',
	PAUSE_SANDBOX: 'pause_sandbox',
	TERMINATE_SANDBOX: 'terminate_sandbox',
	SUSPEND_ORGANIZATION: 'suspend_organization',
	REFER: 'refer',
} as const;
export type AbuseCaseAction =
	(typeof AbuseCaseAction)[keyof typeof AbuseCaseAction];

export const ABUSE_REPORT_MATCH_LOOKBACK_SECONDS = 30 * SECONDS_PER_DAY;

export const IMMEDIATE_TAKEDOWN_CATEGORIES: ReadonlySet<AbuseReportCategory> =
	new Set([AbuseReportCategory.CSAM, AbuseReportCategory.THREAT_TO_LIFE]);

export const AUTOMATIC_TAKEDOWN_NOTE =
	'Disabled automatically on report; a person reviews it within the response target.';

export const ABUSE_EVIDENCE_RETENTION = {
	standardSeconds: 180 * SECONDS_PER_DAY,
	restrictedSeconds: 365 * SECONDS_PER_DAY,
} as const;

export const ABUSE_INTAKE_LIMITS = {
	maximumUrlLength: 2_048,
	maximumTextLength: 10_000,
	maximumNameLength: 200,
	maximumEmailLength: 320,
	maximumSignatureLength: 200,
} as const;

export const PREVIEW_CAPTURE = {
	timeoutMilliseconds: 15_000,
	maximumBodyBytes: 256 * 1_024,
	userAgent: 'Snapflow-Abuse-Evidence/1.0',
} as const;

export const ABUSE_HOSTNAME_RELEASE_JOB = {
	expression: CronExpression.EVERY_MINUTE,
	name: 'release-abuse-hostnames',
	lockKey: 'release-abuse-hostnames',
	lockTtlSeconds: SECONDS_PER_MINUTE,
} as const;

export const ABUSE_EVIDENCE_CLEANUP_JOB = {
	expression: CronExpression.EVERY_HOUR,
	name: 'delete-expired-abuse-evidence',
	lockKey: 'delete-expired-abuse-evidence',
	lockTtlSeconds: 10 * SECONDS_PER_MINUTE,
	batchSize: 500,
} as const;

export const DMCA_RESTORATION = {
	minimumBusinessDays: 10,
	maximumBusinessDays: 14,
	forwardWithinBusinessDays: 1,
	restoreAfterHourUtc: 12,
} as const;

export const DMCA_RESTORATION_JOB = {
	expression: CronExpression.EVERY_HOUR,
	name: 'restore-counter-noticed-material',
	lockKey: 'restore-counter-noticed-material',
	lockTtlSeconds: 10 * SECONDS_PER_MINUTE,
	batchSize: 100,
} as const;

export const AbuseReportErrorCode = {
	REPORT_NOT_FOUND: 'abuse_report_not_found',
	CONTACT_REQUIRED: 'abuse_report_contact_required',
	DMCA_INCOMPLETE: 'abuse_report_dmca_incomplete',
	HUMAN_VERIFICATION_FAILED: 'human_verification_failed',
	ACTION_INVALID: 'abuse_case_action_invalid',
	APPEAL_NOT_ALLOWED: 'abuse_report_appeal_not_allowed',
	COUNTER_NOTICE_REQUIRED: 'abuse_report_counter_notice_required',
	WINDOW_INVALID: 'isp_complaint_window_invalid',
	CONNECTION_WINDOW_INVALID: 'connection_report_window_invalid',
	COURT_ACTION_INVALID: 'abuse_report_court_action_invalid',
	COUNTER_NOTICE_FORWARD_INVALID: 'abuse_report_counter_notice_forward_invalid',
} as const;
export type AbuseReportErrorCode =
	(typeof AbuseReportErrorCode)[keyof typeof AbuseReportErrorCode];

export const OPEN_REPORT_STATUSES = [
	AbuseReportStatus.RECEIVED,
	AbuseReportStatus.ACKNOWLEDGED,
	AbuseReportStatus.MATCHED,
	AbuseReportStatus.UNMATCHED,
	AbuseReportStatus.IN_REVIEW,
	AbuseReportStatus.APPEALED,
] as const;
