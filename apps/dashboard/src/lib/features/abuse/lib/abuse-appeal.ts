/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AbuseAppeal,
	AbuseCaseAction,
	AbuseReportCategory,
	type AppealAbuseDecision,
	type DmcaCounterNotice,
} from '@snapflow/api-client';
import * as z from 'zod';

export type AbuseAppealValues = Pick<AppealAbuseDecision, 'appeal'> &
	DmcaCounterNotice;

export type AbuseAppealTextField = {
	[Key in keyof AbuseAppealValues]: AbuseAppealValues[Key] extends string
		? Key
		: never;
}[keyof AbuseAppealValues];

export type AbuseAppealStatement = Exclude<
	keyof AbuseAppealValues,
	AbuseAppealTextField
>;

export const ABUSE_APPEAL_LIMITS = {
	TEXT_MAX_LENGTH: 10_000,
	SHORT_TEXT_MAX_LENGTH: 200,
} as const satisfies Record<string, number>;

export const EMPTY_ABUSE_APPEAL: AbuseAppealValues = {
	appeal: '',
	removedMaterial: '',
	address: '',
	phone: '',
	signature: '',
	goodFaithMistake: false,
	consentToJurisdiction: false,
};

export const ABUSE_CATEGORY_LABEL = {
	[AbuseReportCategory.Phishing]: 'Phishing',
	[AbuseReportCategory.Malware]: 'Malware',
	[AbuseReportCategory.Csam]: 'Child sexual abuse material',
	[AbuseReportCategory.NonConsensualImagery]: 'Non-consensual intimate imagery',
	[AbuseReportCategory.Copyright]: 'Copyright infringement',
	[AbuseReportCategory.Trademark]: 'Trademark infringement',
	[AbuseReportCategory.NetworkAbuse]: 'Network abuse',
	[AbuseReportCategory.ThreatToLife]: 'Threat to life or safety',
	[AbuseReportCategory.Other]: 'Other abuse',
} as const satisfies Record<AbuseReportCategory, string>;

export const ABUSE_ACTION_LABEL = {
	[AbuseCaseAction.DisablePreview]: 'Preview disabled',
	[AbuseCaseAction.BlockEgress]: 'Outbound traffic blocked',
	[AbuseCaseAction.PauseSandbox]: 'Sandbox paused',
	[AbuseCaseAction.TerminateSandbox]: 'Sandbox terminated',
	[AbuseCaseAction.SuspendOrganization]: 'Organization suspended',
	[AbuseCaseAction.Refer]: 'Referred to the authorities',
} as const satisfies Record<AbuseCaseAction, string>;

const CATEGORY_SEPARATOR = ', ';
const NO_CATEGORY_LABEL = 'Automatic abuse detection';

function requiredText(message: string) {
	return z.string().trim().min(1, message);
}

function confirmedStatement(message: string) {
	return z.boolean().refine((checked) => checked, message);
}

const APPEAL_SCHEMA = z.object({
	appeal: requiredText('Explain why the decision should be reversed.'),
	removedMaterial: z.string(),
	address: z.string(),
	phone: z.string(),
	signature: z.string(),
	goodFaithMistake: z.boolean(),
	consentToJurisdiction: z.boolean(),
});

const COUNTER_NOTICE_SCHEMA = APPEAL_SCHEMA.extend({
	removedMaterial: requiredText(
		'Identify the removed material and where it appeared.'
	),
	address: requiredText('Enter your postal address.'),
	phone: requiredText('Enter your telephone number.'),
	signature: requiredText('Type your full legal name as your signature.'),
	goodFaithMistake: confirmedStatement(
		'Confirm the statement made under penalty of perjury.'
	),
	consentToJurisdiction: confirmedStatement(
		'Confirm your consent to jurisdiction.'
	),
});

export function abuseAppealSchema(counterNoticeRequired: boolean) {
	return counterNoticeRequired ? COUNTER_NOTICE_SCHEMA : APPEAL_SCHEMA;
}

export function categoriesLabel(appeal: AbuseAppeal): string {
	return appeal.categories.length > 0
		? appeal.categories
				.map((category) => ABUSE_CATEGORY_LABEL[category])
				.join(CATEGORY_SEPARATOR)
		: NO_CATEGORY_LABEL;
}

export function toAppealAbuseDecision(
	values: AbuseAppealValues,
	counterNoticeRequired: boolean
): AppealAbuseDecision {
	const { appeal, ...counterNotice } = values;
	return {
		appeal: appeal.trim(),
		counterNotice: counterNoticeRequired
			? {
					...counterNotice,
					removedMaterial: counterNotice.removedMaterial.trim(),
					address: counterNotice.address.trim(),
					phone: counterNotice.phone.trim(),
					signature: counterNotice.signature.trim(),
				}
			: undefined,
	};
}
