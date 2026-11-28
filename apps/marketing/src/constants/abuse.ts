/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { AbuseReportCategory } from '@snapflow/api-client';

export const ABUSE_CATEGORY_LABEL = {
	[AbuseReportCategory.Phishing]: 'Phishing',
	[AbuseReportCategory.Malware]: 'Malware',
	[AbuseReportCategory.Csam]: 'Child sexual abuse material (CSAM)',
	[AbuseReportCategory.NonConsensualImagery]: 'Non-consensual intimate imagery',
	[AbuseReportCategory.Copyright]: 'Copyright infringement (DMCA)',
	[AbuseReportCategory.Trademark]: 'Trademark infringement',
	[AbuseReportCategory.NetworkAbuse]: 'Network abuse (scanning, spam, attacks)',
	[AbuseReportCategory.ThreatToLife]: 'Threat to life or safety',
	[AbuseReportCategory.Other]: 'Something else',
} as const satisfies Record<AbuseReportCategory, string>;

export const ANONYMOUS_CATEGORIES: ReadonlySet<AbuseReportCategory> = new Set([
	AbuseReportCategory.Csam,
	AbuseReportCategory.ThreatToLife,
]);

export const API_BASE_PATH = '/api';

export const ABUSE_REPORT_VERIFICATION_ACTION = 'abuse-report';

export const ABUSE_URL_QUERY_PARAMETER = 'url';

export const ABUSE_FORM_LIMITS = {
	URL: 2_048,
	TEXT: 10_000,
	SHORT_TEXT: 200,
	EMAIL: 320,
} as const;

export const ABUSE_FORM_MESSAGE = {
	VERIFICATION_PENDING:
		'Finish the human check above the submit button, then send the report again.',
	VERIFICATION_UNAVAILABLE:
		'Bot protection could not load. Allow challenges.cloudflare.com and refresh the page.',
	VERIFICATION_FAILED:
		"We couldn't confirm you're human. Refresh the page and try again.",
	CONFIG_UNAVAILABLE:
		'The report form could not reach Snapflow. Try again shortly or email the abuse address below.',
	SUBMIT_FAILED:
		'The report could not be sent. Check the fields and try again, or email the abuse address below.',
} as const;

export const TURNSTILE_SCRIPT_URL =
	'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
