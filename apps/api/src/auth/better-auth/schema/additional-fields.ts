/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const USER_ADDITIONAL_FIELDS = {
	bannedAt: { type: 'date', required: false, input: false },
} as const;

export const SECOND_FACTOR_VERIFIED_AT_FIELD = 'secondFactorVerifiedAt';

export const SESSION_ADDITIONAL_FIELDS = {
	[SECOND_FACTOR_VERIFIED_AT_FIELD]: {
		type: 'date',
		required: false,
		input: false,
	},
} as const;
