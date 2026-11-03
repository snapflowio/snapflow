/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const TOO_MANY_REQUESTS_STATUS = 429;
const RATE_LIMITED_MESSAGE =
	'Too many requests. Please wait a moment before trying again.';

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
	INVALID_OTP: 'Invalid verification code. Please check and try again.',
	OTP_EXPIRED: 'The verification code has expired. Please request a new one.',
	TOO_MANY_ATTEMPTS: 'Too many failed attempts. Please request a new code.',
};

export function authErrorMessage(error: unknown): string {
	const authError = SnapflowError.fromUnknown(error);
	const mapped = authError.code ? AUTH_ERROR_MESSAGES[authError.code] : null;
	if (mapped) return mapped;
	if (readStatus(authError.details) === TOO_MANY_REQUESTS_STATUS) {
		return RATE_LIMITED_MESSAGE;
	}
	return authError.message;
}

function readStatus(details: unknown): unknown {
	if (!details || typeof details !== 'object') return null;
	return Reflect.get(details, 'status');
}
