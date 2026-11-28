/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Ban from '@lucide/svelte/icons/ban';
import CirclePause from '@lucide/svelte/icons/circle-pause';
import EyeOff from '@lucide/svelte/icons/eye-off';
import Landmark from '@lucide/svelte/icons/landmark';
import WifiOff from '@lucide/svelte/icons/wifi-off';
import {
	type AbuseCase,
	AbuseCaseAction,
	AbuseCaseStatus,
	AbuseEvidenceKind,
	type AbuseReport,
	AbuseReportCategory,
	AbuseReporterType,
	AbuseReportStatus,
	IspComplaintOutcome,
	type PublicLegalConfig,
} from '@snapflow/api-client';
import * as z from 'zod';
import type { AbuseReportDecisionInput } from '#lib/api/admin/abuse-reports.ts';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import Trash from '#lib/components/icons/trash.svelte';
import type { NoticeTone } from '#lib/components/ui/notice.svelte';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { formatDateTime, formatOptionalDateTime } from '#lib/utils/format.ts';
import { titleCase } from '#lib/utils/text.ts';

type AbuseReportDecision = AbuseReportDecisionInput['body']['decision'];

export const WITHHELD_LABEL = 'Withheld';

export const WITHHELD_DESCRIPTION =
	'Withheld. Only admins with restricted evidence access can read it.';

export const ABUSE_REPORT_CATEGORY_LABEL = {
	[AbuseReportCategory.Phishing]: 'Phishing',
	[AbuseReportCategory.Malware]: 'Malware',
	[AbuseReportCategory.Csam]: 'CSAM',
	[AbuseReportCategory.NonConsensualImagery]: 'Non-consensual imagery',
	[AbuseReportCategory.Copyright]: 'Copyright (DMCA)',
	[AbuseReportCategory.Trademark]: 'Trademark',
	[AbuseReportCategory.NetworkAbuse]: 'Network abuse',
	[AbuseReportCategory.ThreatToLife]: 'Threat to life',
	[AbuseReportCategory.Other]: 'Other',
} as const satisfies Record<AbuseReportCategory, string>;

export const ABUSE_REPORTER_TYPE_LABEL = {
	[AbuseReporterType.Public]: 'Public report',
	[AbuseReporterType.Host]: 'Host ISP complaint',
	[AbuseReporterType.User]: 'Signed-in user',
} as const satisfies Record<AbuseReporterType, string>;

export const ISP_COMPLAINT_OUTCOME_LABEL = {
	[IspComplaintOutcome.NotSnapflow]: 'Not a customer workload',
	[IspComplaintOutcome.Attributed]: 'Attributed',
	[IspComplaintOutcome.ManualReview]: 'Needs manual review',
	[IspComplaintOutcome.RecordsIncomplete]: 'Records incomplete',
} as const satisfies Record<IspComplaintOutcome, string>;

export const ABUSE_EVIDENCE_KIND_LABEL = {
	[AbuseEvidenceKind.SandboxSnapshot]: 'Sandbox metadata',
	[AbuseEvidenceKind.ConnectionRecords]: 'Connection records',
	[AbuseEvidenceKind.PreviewCapture]: 'Preview capture',
} as const satisfies Record<AbuseEvidenceKind, string>;

export const ABUSE_CASE_ACTION_LABEL = {
	[AbuseCaseAction.DisablePreview]: 'Disable preview',
	[AbuseCaseAction.BlockEgress]: 'Block egress',
	[AbuseCaseAction.PauseSandbox]: 'Pause sandbox',
	[AbuseCaseAction.TerminateSandbox]: 'Terminate sandbox',
	[AbuseCaseAction.SuspendOrganization]: 'Suspend organization',
	[AbuseCaseAction.Refer]: 'Refer to authorities',
} as const satisfies Record<AbuseCaseAction, string>;

export const ABUSE_CASE_ACTION_ICON = {
	[AbuseCaseAction.DisablePreview]: EyeOff,
	[AbuseCaseAction.BlockEgress]: WifiOff,
	[AbuseCaseAction.PauseSandbox]: CirclePause,
	[AbuseCaseAction.TerminateSandbox]: Trash,
	[AbuseCaseAction.SuspendOrganization]: Ban,
	[AbuseCaseAction.Refer]: Landmark,
} as const satisfies Record<AbuseCaseAction, IconComponent>;

export const ABUSE_CASE_ACTION_DESCRIPTION = {
	[AbuseCaseAction.DisablePreview]:
		'Every preview, custom domain and port route of the sandbox serves the abuse takedown page.',
	[AbuseCaseAction.BlockEgress]:
		'All outbound traffic of the sandbox is blocked, on every start, until the case is resolved.',
	[AbuseCaseAction.PauseSandbox]:
		'The sandbox is stopped and cannot start again until the case is resolved; its disk is kept as evidence.',
	[AbuseCaseAction.TerminateSandbox]:
		'The sandbox is destroyed after its evidence is preserved.',
	[AbuseCaseAction.SuspendOrganization]:
		'The whole organization is suspended until the case is resolved.',
	[AbuseCaseAction.Refer]:
		'Records that the case was referred to NCMEC or law enforcement.',
} as const satisfies Record<AbuseCaseAction, string>;

export const ABUSE_CASE_ACTION_APPLIED_AT = {
	[AbuseCaseAction.DisablePreview]: 'previewDisabledAt',
	[AbuseCaseAction.BlockEgress]: 'egressBlockedAt',
	[AbuseCaseAction.PauseSandbox]: 'pausedAt',
	[AbuseCaseAction.TerminateSandbox]: 'terminatedAt',
	[AbuseCaseAction.SuspendOrganization]: 'organizationSuspendedAt',
	[AbuseCaseAction.Refer]: 'referredAt',
} as const satisfies Record<AbuseCaseAction, keyof AbuseCase>;

export const ABUSE_CASE_ACTIONS = Object.values(AbuseCaseAction);

const DESTRUCTIVE_CASE_ACTIONS: ReadonlySet<AbuseCaseAction> = new Set([
	AbuseCaseAction.TerminateSandbox,
	AbuseCaseAction.SuspendOrganization,
]);

export function isDestructiveCaseAction(action: AbuseCaseAction): boolean {
	return DESTRUCTIVE_CASE_ACTIONS.has(action);
}

export function caseActionAppliedAt(
	abuseCase: AbuseCase,
	action: AbuseCaseAction
): string | null {
	return abuseCase[ABUSE_CASE_ACTION_APPLIED_AT[action]];
}

const CASE_ENFORCEMENT_STEPS = [
	{ field: 'throttledAt', label: 'Throttled' },
	{ field: 'notifiedAt', label: 'Notified' },
	{ field: 'suspendedAt', label: 'Suspended' },
] as const satisfies readonly { field: keyof AbuseCase; label: string }[];

export interface AppliedCaseAction {
	label: string;
	appliedAt: string;
}

export function appliedCaseActions(abuseCase: AbuseCase): AppliedCaseAction[] {
	const steps = [
		...CASE_ENFORCEMENT_STEPS.map((step) => ({
			label: step.label,
			at: abuseCase[step.field],
		})),
		...ABUSE_CASE_ACTIONS.map((action) => ({
			label: ABUSE_CASE_ACTION_LABEL[action],
			at: caseActionAppliedAt(abuseCase, action),
		})),
	];
	return steps.flatMap((step) =>
		step.at ? [{ label: step.label, appliedAt: formatDateTime(step.at) }] : []
	);
}

export function isOpenAbuseCase(abuseCase: AbuseCase | null): boolean {
	return abuseCase !== null && abuseCase.status !== AbuseCaseStatus.Resolved;
}

export const ABUSE_REPORT_DECISIONS = [
	AbuseReportStatus.Actioned,
	AbuseReportStatus.NoAction,
	AbuseReportStatus.Referred,
] as const satisfies readonly AbuseReportDecision[];

export const ABUSE_REPORT_DECISION_LABEL = {
	[AbuseReportStatus.Actioned]: 'Actioned',
	[AbuseReportStatus.NoAction]: 'No action',
	[AbuseReportStatus.Referred]: 'Referred',
} as const satisfies Record<AbuseReportDecision, string>;

export const ABUSE_REPORT_DECISION_DESCRIPTION = {
	[AbuseReportStatus.Actioned]:
		'The report was valid and the ladder actions above dealt with it. The reporter is told action was taken.',
	[AbuseReportStatus.NoAction]:
		'The report did not show a violation. The reporter is told no action was taken.',
	[AbuseReportStatus.Referred]:
		'The report was passed to NCMEC or law enforcement.',
} as const satisfies Record<AbuseReportDecision, string>;

const DECIDED_STATUSES: ReadonlySet<AbuseReportStatus> = new Set([
	AbuseReportStatus.Actioned,
	AbuseReportStatus.NoAction,
	AbuseReportStatus.Referred,
	AbuseReportStatus.Closed,
]);

export function isDecidedReport(report: AbuseReport): boolean {
	return DECIDED_STATUSES.has(report.status);
}

export function isOverdueReport(report: AbuseReport, now: number): boolean {
	return !isDecidedReport(report) && Date.parse(report.dueAt) < now;
}

export function reportTarget(report: AbuseReport): string {
	if (report.withheld) return WITHHELD_LABEL;
	return (
		report.url ?? report.hostname ?? report.ispComplaint?.sourceAddress ?? ''
	);
}

export const ABUSE_REPORT_SORT_OPTIONS = [
	{ id: 'due', label: 'Due' },
	{ id: 'received', label: 'Received' },
] as const;

export const ABUSE_REPORT_STATUS_OPTIONS = Object.values(AbuseReportStatus).map(
	(status) => ({ label: titleCase(status), value: status })
);

export const ABUSE_REPORT_CATEGORY_OPTIONS = Object.values(
	AbuseReportCategory
).map((category) => ({
	label: ABUSE_REPORT_CATEGORY_LABEL[category],
	value: category,
}));

export const ABUSE_REPORT_FILTER_KEYS = ['status', 'category'] as const;

export const abuseReportsSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['due', 'received']),
	status: searchParamArray(z.enum(AbuseReportStatus)).catch([]),
	category: searchParamArray(z.enum(AbuseReportCategory)).catch([]),
});

export const CounterNoticeState = {
	NOT_FORWARDED: 'not_forwarded',
	WAITING: 'waiting',
	RESTORE_DUE: 'restore_due',
	PAST_RESTORE_BY: 'past_restore_by',
	COURT_ACTION: 'court_action',
	RESTORED: 'restored',
} as const;

export type CounterNoticeState =
	(typeof CounterNoticeState)[keyof typeof CounterNoticeState];

export const COUNTER_NOTICE_STATE_LABEL = {
	[CounterNoticeState.NOT_FORWARDED]: () =>
		'Complainant copy not sent; forward it and record it',
	[CounterNoticeState.WAITING]: ({ dmcaRestoreAfterBusinessDays }) =>
		`Waiting ${dmcaRestoreAfterBusinessDays} business days`,
	[CounterNoticeState.RESTORE_DUE]: () => 'Restoration due',
	[CounterNoticeState.PAST_RESTORE_BY]: () =>
		'Past restore-by; restore manually or record the court action',
	[CounterNoticeState.COURT_ACTION]: () => 'Court action filed, not restored',
	[CounterNoticeState.RESTORED]: () => 'Restored',
} as const satisfies Record<
	CounterNoticeState,
	(legal: PublicLegalConfig) => string
>;

export function counterNoticeState(
	report: AbuseReport,
	now = Date.now()
): CounterNoticeState {
	if (report.restoredAt) return CounterNoticeState.RESTORED;
	if (report.courtActionFiledAt) return CounterNoticeState.COURT_ACTION;
	if (report.restoreBy && Date.parse(report.restoreBy) < now) {
		return CounterNoticeState.PAST_RESTORE_BY;
	}
	if (!report.counterNoticeForwardedAt) return CounterNoticeState.NOT_FORWARDED;
	return report.restoreAfter && Date.parse(report.restoreAfter) <= now
		? CounterNoticeState.RESTORE_DUE
		: CounterNoticeState.WAITING;
}

export function counterNoticeForwardOverdue(
	report: AbuseReport,
	now = Date.now()
): boolean {
	return (
		report.counterNoticeForwardDueAt !== null &&
		Date.parse(report.counterNoticeForwardDueAt) < now
	);
}

export interface CounterNoticeAlert {
	tone: Extract<NoticeTone, 'warning' | 'error'>;
	title: string;
	info: string;
}

const NOT_SCHEDULED = 'not scheduled';

export function counterNoticeAlert(
	report: AbuseReport,
	legal: PublicLegalConfig,
	now = Date.now()
): CounterNoticeAlert | null {
	if (!report.counterNotice) return null;
	if (counterNoticeState(report, now) === CounterNoticeState.NOT_FORWARDED) {
		return {
			tone: counterNoticeForwardOverdue(report, now) ? 'error' : 'warning',
			title: 'Complainant copy not yet sent',
			info: `Due ${formatOptionalDateTime(report.counterNoticeForwardDueAt, NOT_SCHEDULED)}. Restoration is scheduled only once the copy is sent. If the email did not go out, send it by hand and record it.`,
		};
	}
	if (report.counterNoticeForwardedLate) {
		return {
			tone: 'warning',
			title: `Late copy: restoration extends past ${legal.dmcaRestoreByBusinessDays} business days`,
			info: `The complainant still gets ${legal.dmcaRestoreAfterBusinessDays} business days from their copy, so restore-by moved past the statutory deadline.`,
		};
	}
	return null;
}

export function canRecordCourtAction(report: AbuseReport): boolean {
	return (
		report.counterNoticeReceivedAt !== null &&
		report.courtActionFiledAt === null &&
		report.restoredAt === null
	);
}

export function canRecordCounterNoticeForwarded(report: AbuseReport): boolean {
	return (
		report.counterNoticeReceivedAt !== null &&
		report.counterNoticeForwardedAt === null &&
		report.restoredAt === null
	);
}
