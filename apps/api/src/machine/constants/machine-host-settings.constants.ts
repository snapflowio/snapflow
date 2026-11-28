/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	HOURS_PER_DAY,
	MINUTES_PER_HOUR,
} from '../../common/constants/time.constants';

export const MACHINE_MAINTENANCE_WINDOW = {
	MINUTES_PER_DAY: HOURS_PER_DAY * MINUTES_PER_HOUR,
	MINIMUM_DURATION_MINUTES: MINUTES_PER_HOUR,
	MAXIMUM_DURATION_MINUTES: (HOURS_PER_DAY / 2) * MINUTES_PER_HOUR,
} as const;

export const MACHINE_OFFER_LIMITS = {
	MAXIMUM_VCPUS: 1_024,
	MAXIMUM_MEMORY_GIB: 16_384,
	MAXIMUM_DISK_GIB: 1_048_576,
} as const;

export const MACHINE_UNCLAIMED_FLOAT_LIMITS = {
	MINIMUM: 1n,
	MAXIMUM: 1_000_000_000_000n,
} as const;

export const MACHINE_DEFAULT_UNCLAIMED_FLOAT_USDC = 25;

export const MACHINE_UNCLAIMED_FLOAT_PATTERN = /^[1-9][0-9]{0,12}$/;

export const MACHINE_HOST_SETTINGS_SCHEMA_VERSION = 4;

export const MACHINE_HOST_SETTINGS_WAKE_TOPIC = 'machine-host-settings';

export const MachineHostSettingsErrorCode = {
	FLOAT_TOO_LARGE: 'machine_unclaimed_float_too_large',
} as const;
