/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

export const AUTH_RATE_LIMIT_RULES = {
	'/email-otp/send-verification-otp': {
		window: 5 * SECONDS_PER_MINUTE,
		max: 3,
	},
	'/email-otp/*': { window: SECONDS_PER_MINUTE, max: 5 },
	'/sign-in/email-otp': { window: 5 * SECONDS_PER_MINUTE, max: 5 },
	'/sign-in/*': { window: SECONDS_PER_MINUTE, max: 5 },
	'/passkey/generate-authenticate-options': {
		window: SECONDS_PER_MINUTE,
		max: 10,
	},
	'/passkey/verify-authentication': { window: SECONDS_PER_MINUTE, max: 10 },
	'/two-factor/verify-totp': { window: 5 * SECONDS_PER_MINUTE, max: 5 },
	'/two-factor/verify-backup-code': {
		window: 5 * SECONDS_PER_MINUTE,
		max: 5,
	},
	'/device/code': { window: SECONDS_PER_MINUTE, max: 10 },
	'/device/token': { window: SECONDS_PER_MINUTE, max: 30 },
	'/device/approve': { window: SECONDS_PER_MINUTE, max: 10 },
	'/device/deny': { window: SECONDS_PER_MINUTE, max: 10 },
	'/admin/impersonate-user': { window: SECONDS_PER_MINUTE, max: 5 },
	'/delete-user': { window: SECONDS_PER_MINUTE, max: 3 },
} as const satisfies Record<string, { max: number; window: number }>;

export const SESSION_FRESH_AGE_SECONDS = SECONDS_PER_DAY;

export const EMAIL_OTP_LENGTH = 6;
export const EMAIL_OTP_EXPIRES_IN_SECONDS = 10 * SECONDS_PER_MINUTE;
export const EMAIL_OTP_ALLOWED_ATTEMPTS = 3;

export const IMPERSONATION_SESSION_DURATION_SECONDS = 30 * SECONDS_PER_MINUTE;
