/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SocialProvider } from '@snapflow/api-client';

export const LOGIN_METHOD = {
	EMAIL_OTP: 'email-otp',
	PASSKEY: 'passkey',
} as const;

export type LoginMethod =
	| (typeof LOGIN_METHOD)[keyof typeof LOGIN_METHOD]
	| SocialProvider;
