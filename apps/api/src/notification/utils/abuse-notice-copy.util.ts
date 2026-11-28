/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ABUSE_CATEGORY_LABEL,
	ABUSE_SIGNAL_LABEL,
} from '../../abuse/constants/abuse-copy.constants';
import {
	AbuseReportCategory,
	RESTRICTED_REPORT_CATEGORIES,
} from '../../abuse/constants/abuse-report.constants';
import {
	AbuseNoticeAudience,
	AbuseNoticeKind,
	DASHBOARD_NOTICE_PATH,
} from '../constants/notice.constants';
import type { AbuseNotice } from '../events/abuse-notice.event';
import type { NoticeAction, NoticeCopy } from '../types/notice.types';

const SIGNAL_LIST_SEPARATOR = ', ';

const CUSTOMER_ACTION_SUMMARY = {
	[AbuseNoticeKind.CASE_OPENED]: 'is under review',
	[AbuseNoticeKind.THROTTLED]: 'was slowed down',
	[AbuseNoticeKind.SUSPENDED]: 'was stopped and your organization suspended',
	[AbuseNoticeKind.PREVIEW_DISABLED]: 'has its previews disabled',
	[AbuseNoticeKind.EGRESS_BLOCKED]: 'has its outbound network blocked',
	[AbuseNoticeKind.PAUSED]: 'was stopped',
	[AbuseNoticeKind.TERMINATED]: 'was deleted',
	[AbuseNoticeKind.RESOLVED]: 'is no longer restricted',
} as const satisfies Record<AbuseNoticeKind, string>;

const HOST_ACTION_SUMMARY = {
	[AbuseNoticeKind.CASE_OPENED]: 'opened a case to review it',
	[AbuseNoticeKind.THROTTLED]: 'limited its bandwidth and new connections',
	[AbuseNoticeKind.SUSPENDED]: 'stopped it',
	[AbuseNoticeKind.PREVIEW_DISABLED]: 'disabled its public previews',
	[AbuseNoticeKind.EGRESS_BLOCKED]: 'blocked all its outbound network traffic',
	[AbuseNoticeKind.PAUSED]: 'stopped it',
	[AbuseNoticeKind.TERMINATED]: 'deleted it',
	[AbuseNoticeKind.RESOLVED]: 'closed the case',
} as const satisfies Record<AbuseNoticeKind, string>;

function signalList(notice: AbuseNotice): string {
	return notice.signals
		.map((signal) => ABUSE_SIGNAL_LABEL[signal])
		.join(SIGNAL_LIST_SEPARATOR);
}

function viewSandbox(notice: AbuseNotice): NoticeAction {
	return {
		label: 'View sandbox',
		path: `${DASHBOARD_NOTICE_PATH.SANDBOXES}/${encodeURIComponent(notice.sandboxId)}`,
	};
}

function appeal(notice: AbuseNotice): NoticeAction {
	return {
		label:
			notice.category === AbuseReportCategory.COPYRIGHT
				? 'Send a counter-notice'
				: 'Appeal this decision',
		path: `${DASHBOARD_NOTICE_PATH.ABUSE_APPEALS}/${encodeURIComponent(notice.caseId)}`,
	};
}

function viewMachine(notice: AbuseNotice): NoticeAction {
	return notice.machineId
		? {
				label: 'View machine',
				path: `${DASHBOARD_NOTICE_PATH.MACHINES}/${encodeURIComponent(notice.machineId)}`,
			}
		: { label: 'View machines', path: DASHBOARD_NOTICE_PATH.MACHINES };
}

function detectorCustomerCopy(notice: AbuseNotice): NoticeCopy {
	const signals = signalList(notice);
	if (notice.kind === AbuseNoticeKind.THROTTLED) {
		return {
			subject: `${notice.sandboxName} was slowed down`,
			heading: `${notice.sandboxName} was slowed down`,
			paragraphs: [
				`The machine running ${notice.sandboxName} saw network activity that looks like abuse: ${signals}.`,
				'Its bandwidth and new connections are limited until the activity stops. If it continues, the sandbox is stopped and your organization is suspended for review.',
			],
			note: 'If this is legitimate work, reply to this email so we can review it.',
			action: viewSandbox(notice),
		};
	}
	return {
		subject: `${notice.sandboxName} was stopped`,
		heading: `${notice.sandboxName} was stopped`,
		paragraphs: [
			`The machine running ${notice.sandboxName} saw network activity that breaks the acceptable use policy: ${signals}.`,
			'The sandbox was stopped and its data kept. Your organization is suspended until we review the case.',
		],
		note: 'Reply to this email if you believe this is a mistake.',
		action: viewSandbox(notice),
	};
}

function reasonParagraph(category: AbuseReportCategory) {
	if (RESTRICTED_REPORT_CATEGORIES.has(category)) {
		return 'We acted on a report about content served from this sandbox, as our acceptable use policy and the law require.';
	}
	return `We received a report that this sandbox was used for ${ABUSE_CATEGORY_LABEL[category]} and reviewed it against the acceptable use policy.`;
}

function reportCustomerCopy(
	notice: AbuseNotice,
	category: AbuseReportCategory
): NoticeCopy {
	const summary = `${notice.sandboxName} ${CUSTOMER_ACTION_SUMMARY[notice.kind]}`;
	if (notice.kind === AbuseNoticeKind.RESOLVED) {
		return {
			subject: summary,
			heading: summary,
			paragraphs: [
				`The abuse case on ${notice.sandboxName} is closed and the restrictions we placed on it are lifted.`,
			],
			note: `Case ${notice.caseId}.`,
			action: viewSandbox(notice),
		};
	}
	return {
		subject: summary,
		heading: summary,
		paragraphs: [
			reasonParagraph(category),
			`As a result, ${summary}. Your other sandboxes are not affected unless this notice says your organization was suspended.`,
		],
		note: `Case ${notice.caseId}. You can appeal this decision; a person reviews every appeal.`,
		action: appeal(notice),
	};
}

function customerCopy(notice: AbuseNotice): NoticeCopy {
	return notice.category === null
		? detectorCustomerCopy(notice)
		: reportCustomerCopy(notice, notice.category);
}

function hostCopy(notice: AbuseNotice): NoticeCopy {
	const machine = notice.machineName ?? 'your machine';
	if (notice.kind === AbuseNoticeKind.RESOLVED) {
		return {
			subject: `Snapflow closed an abuse case on ${machine}`,
			heading: `Snapflow closed an abuse case on ${machine}`,
			paragraphs: [
				`The abuse case on a customer sandbox on ${machine} is closed.`,
			],
			note: `Case ${notice.caseId}. You do not need to do anything.`,
			action: viewMachine(notice),
		};
	}
	const cause =
		notice.category === null
			? `showed network activity that looks like abuse: ${signalList(notice)}`
			: 'was reported for abuse';
	if (notice.kind === AbuseNoticeKind.CASE_OPENED) {
		return {
			subject: `Snapflow opened an abuse case on ${machine}`,
			heading: `Snapflow opened an abuse case on ${machine}`,
			paragraphs: [
				`A customer sandbox on ${machine} ${cause}.`,
				`Snapflow ${HOST_ACTION_SUMMARY[notice.kind]} and will tell you when it acts on the sandbox or closes the case.`,
			],
			note: `Case ${notice.caseId}. You do not need to do anything.`,
			action: viewMachine(notice),
		};
	}
	return {
		subject: `Snapflow acted on a sandbox on ${machine}`,
		heading: `Snapflow acted on a sandbox on ${machine}`,
		paragraphs: [
			`A customer sandbox on ${machine} ${cause}.`,
			`Snapflow ${HOST_ACTION_SUMMARY[notice.kind]} to protect your network and IP address.`,
		],
		note: `Case ${notice.caseId}. You do not need to do anything.`,
		action: viewMachine(notice),
	};
}

export function abuseNoticeCopy(
	organizationName: string,
	notice: AbuseNotice
): NoticeCopy {
	const copy =
		notice.audience === AbuseNoticeAudience.CUSTOMER
			? customerCopy(notice)
			: hostCopy(notice);
	return { ...copy, subject: `${organizationName}: ${copy.subject}` };
}
