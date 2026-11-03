/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FullJitterBackoff } from '../../../common/utils/concurrency/full-jitter-backoff.util';

export const EMAIL_DELIVERY = Symbol('EMAIL_DELIVERY');

export const EMAIL_PRODUCT_NAME = 'Snapflow';

export const EMAIL_WEBSITE_PATHS = {
	logo: '/email/snapflow-logo.png',
	font: '/fonts/InstrumentSans-latin.woff2',
	terms: '/terms',
	privacy: '/privacy',
} as const;

export const EMAIL_LOGO_SIZE_PIXELS = 48;

export const EMAIL_COLORS = {
	page: '#f0ede6',
	card: '#ffffff',
	border: '#e2ddd3',
	heading: '#151413',
	body: '#3f3e3c',
	muted: '#6b6966',
	codeSurface: '#f0ede6',
	primary: '#8b5cf6',
	onPrimary: '#ffffff',
} as const;

export const EMAIL_DARK_COLORS = {
	page: '#151413',
	card: '#1d1c1b',
	border: '#302f2d',
	heading: '#f0ede6',
	body: '#d6d3cc',
	muted: '#9c9993',
	codeSurface: '#232221',
} as const;

export const EMAIL_FONT_STACK =
	'"Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const EMAIL_MONO_FONT_STACK =
	'"Chivo Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const EMAIL_CATEGORY = {
	ONE_TIME_CODE: 'one-time-code',
	ORGANIZATION_INVITATION: 'organization-invitation',
} as const;

export type EmailCategory =
	(typeof EMAIL_CATEGORY)[keyof typeof EMAIL_CATEGORY];

export const EMAIL_TAG_NAME = {
	CATEGORY: 'category',
	PURPOSE: 'purpose',
} as const;

export const EMAIL_THREAD_HEADER = 'X-Entity-Ref-ID';

export const EMAIL_DELIVERY_POLICY: Readonly<{
	maxAttempts: number;
	backoff: FullJitterBackoff;
}> = {
	maxAttempts: 3,
	backoff: { baseMilliseconds: 250, capMilliseconds: 2000 },
};

export const RETRYABLE_RESEND_ERRORS: ReadonlySet<string> = new Set([
	'rate_limit_exceeded',
	'concurrent_idempotent_requests',
	'application_error',
	'internal_server_error',
]);

export const FIRST_SERVER_ERROR_STATUS = 500;

export const ONE_TIME_CODE_PURPOSE = {
	SIGN_IN: 'sign-in',
	EMAIL_VERIFICATION: 'email-verification',
} as const;

export type OneTimeCodePurpose =
	(typeof ONE_TIME_CODE_PURPOSE)[keyof typeof ONE_TIME_CODE_PURPOSE];

export const ONE_TIME_CODE_COPY: Record<
	OneTimeCodePurpose,
	{
		subject: string;
		preview: string;
		heading: string;
		instruction: string;
		ignoreNote: string;
	}
> = {
	[ONE_TIME_CODE_PURPOSE.SIGN_IN]: {
		subject: 'Your Snapflow sign-in code',
		preview: 'Use this code to sign in to Snapflow.',
		heading: 'Sign in to Snapflow',
		instruction:
			'Enter this code on the sign-in page to continue. It works once.',
		ignoreNote:
			'If you did not try to sign in, you can ignore this email. Nobody can sign in without the code.',
	},
	[ONE_TIME_CODE_PURPOSE.EMAIL_VERIFICATION]: {
		subject: 'Verify your email for Snapflow',
		preview: 'Use this code to verify your email address.',
		heading: 'Verify your email',
		instruction: 'Enter this code in Snapflow to confirm this email address.',
		ignoreNote:
			'If you did not request this, you can ignore this email and the address stays unverified.',
	},
};
