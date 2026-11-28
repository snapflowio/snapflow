/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { API_KEY_ERROR_CODES } from '@better-auth/api-key/client';
import { BASE_ERROR_CODES } from '@better-auth/core/error';
import { PASSKEY_ERROR_CODES } from '@better-auth/passkey/client';
import {
	ADMIN_ERROR_CODES,
	EMAIL_OTP_ERROR_CODES,
	ORGANIZATION_ERROR_CODES,
	TWO_FACTOR_ERROR_CODES,
} from 'better-auth/client/plugins';

export const AuthError = {
	...BASE_ERROR_CODES,
	...EMAIL_OTP_ERROR_CODES,
	...TWO_FACTOR_ERROR_CODES,
	...PASSKEY_ERROR_CODES,
	...ADMIN_ERROR_CODES,
	...ORGANIZATION_ERROR_CODES,
	...API_KEY_ERROR_CODES,
} as const;

export type AuthErrorCode = (typeof AuthError)[keyof typeof AuthError]['code'];

export const AUTH_ERROR_CODES: readonly AuthErrorCode[] = Object.values(
	AuthError
).map(({ code }) => code);
