/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const AUTH_BASE_PATH = '/api/auth';

export const AUTH_PATH = {
	ADMIN_PREFIX: '/admin/',
	ADMIN_REMOVE_USER: '/admin/remove-user',
	ADMIN_IMPERSONATE_USER: '/admin/impersonate-user',
	ADMIN_STOP_IMPERSONATING: '/admin/stop-impersonating',
	ORGANIZATION_PREFIX: '/organization/',
	API_KEY_DELETE: '/api-key/delete',
	API_KEY_UPDATE: '/api-key/update',
	PASSKEY_VERIFY_AUTHENTICATION: '/passkey/verify-authentication',
	TWO_FACTOR_VERIFY_TOTP: '/two-factor/verify-totp',
	TWO_FACTOR_VERIFY_BACKUP_CODE: '/two-factor/verify-backup-code',
} as const;

export const SECOND_FACTOR_STEP_UP_PATHS: ReadonlySet<string> = new Set([
	AUTH_PATH.TWO_FACTOR_VERIFY_TOTP,
	AUTH_PATH.TWO_FACTOR_VERIFY_BACKUP_CODE,
]);

export const FRESH_SESSION_AUTH_PATHS: ReadonlySet<string> = new Set([
	'/admin/ban-user',
	AUTH_PATH.ADMIN_IMPERSONATE_USER,
	AUTH_PATH.ADMIN_REMOVE_USER,
	'/admin/revoke-user-session',
	'/admin/revoke-user-sessions',
	'/admin/set-role',
	'/admin/unban-user',
	'/admin/update-user',
	'/get-access-token',
	'/passkey/delete-passkey',
	'/refresh-token',
	'/two-factor/disable',
	'/two-factor/enable',
	'/two-factor/generate-backup-codes',
	'/two-factor/get-totp-uri',
	'/unlink-account',
]);

export const DISABLED_AUTH_PATHS = [
	'/sign-in/email',
	'/sign-up/email',
	'/request-password-reset',
	'/reset-password',
	'/change-password',
	'/verify-password',
	'/send-verification-email',
	'/verify-email',
	'/admin/set-user-password',
	'/email-otp/request-password-reset',
	'/email-otp/reset-password',
	'/forget-password/email-otp',
	'/two-factor/send-otp',
	'/two-factor/verify-otp',
	'/api-key/create',
];
