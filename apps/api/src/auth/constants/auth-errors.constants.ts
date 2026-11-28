/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BASE_ERROR_CODES } from '@better-auth/core/error';
import { SANCTIONED_REGION_MESSAGE } from '../../location/constants/sanctioned-region.constants';

export const AUTH_ERROR = {
	FRESH_SESSION_REQUIRED: {
		code: BASE_ERROR_CODES.SESSION_NOT_FRESH.code,
		message: 'Recent authentication is required. Sign in again and retry.',
	},
	DISPOSABLE_EMAIL: {
		code: 'DISPOSABLE_EMAIL',
		message:
			'Disposable email addresses cannot create a Snapflow account. Sign up with a permanent email address.',
	},
	SANCTIONED_REGION: {
		code: 'SANCTIONED_REGION',
		message: SANCTIONED_REGION_MESSAGE,
	},
} as const;
