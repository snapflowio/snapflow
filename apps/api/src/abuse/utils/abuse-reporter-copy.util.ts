/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AbuseReportDecision,
	AbuseReportStatus,
	DMCA_RESTORATION,
} from '../constants/abuse-report.constants';
import type { DmcaCounterNoticeDto } from '../dto/abuse-report-intake.dto';
import type { AbuseReport } from '../entities/abuse-report.entity';

export const ReporterEmailStage = {
	ACKNOWLEDGED: 'acknowledged',
	DECIDED: 'decided',
	COUNTER_NOTICE: 'counter_notice',
} as const;

const DECISION_PARAGRAPH = {
	[AbuseReportStatus.ACTIONED]:
		'We reviewed your report and took action against the content under our acceptable use policy.',
	[AbuseReportStatus.NO_ACTION]:
		'We reviewed your report and did not find a violation of our acceptable use policy that we can act on.',
	[AbuseReportStatus.REFERRED]:
		'We reviewed your report and referred it to the appropriate authority.',
} as const satisfies Record<AbuseReportDecision, string>;

type ReportForCopy = Pick<AbuseReport, 'id' | 'url' | 'dueAt'>;

function reference(report: ReportForCopy): string {
	return `Report ${report.id}`;
}

export function reporterAcknowledgementCopy(report: ReportForCopy) {
	return {
		subject: `We received your abuse report (${reference(report)})`,
		heading: 'We received your report',
		paragraphs: [
			report.url
				? `Thank you for reporting ${report.url}. A person reviews every report.`
				: 'Thank you for your report. A person reviews every report.',
			`We aim to respond by ${report.dueAt.toUTCString()}.`,
		],
		note: `${reference(report)}. Reply to this email to add information.`,
	};
}

export function reporterDecisionCopy(
	report: ReportForCopy,
	decision: AbuseReportDecision
) {
	return {
		subject: `Update on your abuse report (${reference(report)})`,
		heading: 'We reviewed your report',
		paragraphs: [DECISION_PARAGRAPH[decision]],
		note: `${reference(report)}. Reply to this email if you have more information.`,
	};
}

export function reporterCounterNoticeCopy(
	report: ReportForCopy,
	counterNotice: DmcaCounterNoticeDto,
	restoreAfter: Date
) {
	return {
		subject: `Counter-notice received for your copyright report (${reference(report)})`,
		heading: 'We received a counter-notice',
		paragraphs: [
			report.url
				? `The subscriber responsible for the material you reported at ${report.url} sent a counter-notification under 17 U.S.C. 512(g)(3). A copy follows.`
				: 'The subscriber responsible for the material you reported sent a counter-notification under 17 U.S.C. 512(g)(3). A copy follows.',
			`Material removed and where it appeared: ${counterNotice.removedMaterial}`,
			`Name and signature: ${counterNotice.signature}`,
			`Address: ${counterNotice.address}`,
			`Telephone: ${counterNotice.phone}`,
			'Under penalty of perjury, the subscriber states a good faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.',
			'The subscriber consents to the jurisdiction of the Federal District Court for the judicial district in which the address above is located, or, if that address is outside the United States, any judicial district in which Snapflow may be found, and will accept service of process from you or your agent.',
			`We will replace the removed material or cease disabling access to it ${DMCA_RESTORATION.minimumBusinessDays} business days after this copy, on or after ${restoreAfter.toUTCString()}, unless our designated agent first receives notice from you that you have filed an action seeking a court order to restrain the subscriber from engaging in infringing activity relating to the material on our system or network.`,
		],
		note: `${reference(report)}. To stop the restoration, reply to this email with a copy of the court filing.`,
	};
}
