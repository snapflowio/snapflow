/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SECONDS_PER_DAY,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import { API_KEY_PREFIX } from './api-key.constants';

export const MACHINE_ENROLLMENT_KEY_PREFIX = `${API_KEY_PREFIX}enroll_`;

export const MACHINE_ENROLLMENT_KEY_PERMISSIONS = {
	machine: ['enroll'],
} as const;

export const MACHINE_ENROLLMENT_KEY_CREATOR_PERMISSIONS = {
	machines: ['write'],
	apiKey: ['create'],
} as const;

export const MACHINE_ENROLLMENT_KEY_READER_PERMISSIONS = {
	machines: ['read'],
} as const;

export const MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS = {
	MINIMUM: 10 * SECONDS_PER_MINUTE,
	SINGLE_USE_DEFAULT: SECONDS_PER_HOUR,
	SINGLE_USE_MAXIMUM: SECONDS_PER_DAY,
	REUSABLE_DEFAULT: 7 * SECONDS_PER_DAY,
	REUSABLE_MAXIMUM: 90 * SECONDS_PER_DAY,
} as const;

export const MACHINE_ENROLLMENT_KEY_LIST_MAX = 100;

export const MachineEnrollmentKeyErrorCode = {
	KEY_INVALID: 'machine_enrollment_key_invalid',
	KEY_USED: 'machine_enrollment_key_used',
	LIFETIME_TOO_LONG: 'machine_enrollment_key_lifetime_too_long',
	KEY_NOT_FOUND: 'machine_enrollment_key_not_found',
} as const;
