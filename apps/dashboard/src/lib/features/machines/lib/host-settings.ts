/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	MachineHostSettings,
	MachineMaintenanceWindow,
	MachineOffer,
} from '@snapflow/api-client';
import { formatTimeLabel } from '#lib/components/ui/chip/chip-time-picker.svelte';
import { formatCount } from '#lib/utils/format.ts';
import { formatMicroUsdAmount, usdInputToMicroUsd } from '#lib/utils/usd.ts';
import {
	DEFAULT_MAINTENANCE_WINDOW,
	MACHINE_OFFER_LIMITS,
	MAINTENANCE_WINDOW_LIMITS,
	MINUTES_PER_DAY,
	MINUTES_PER_HOUR,
	UNCLAIMED_FLOAT_LIMITS,
} from './host-settings-limits.ts';

export interface HostSettingsDraft {
	customWindow: boolean;
	windowStart: string;
	windowDuration: string;
	vcpus: string;
	memoryGiB: string;
	diskGiB: string;
	maxUnclaimedFloat: string;
}

type HostSettingsErrors = Partial<Record<keyof HostSettingsDraft, string>>;

type OfferField = keyof MachineOffer;

export const HOST_SETTINGS_FIELDS = [
	'customWindow',
	'windowStart',
	'windowDuration',
	'vcpus',
	'memoryGiB',
	'diskGiB',
	'maxUnclaimedFloat',
] as const satisfies readonly (keyof HostSettingsDraft)[];

export const OFFER_FIELDS = [
	{
		key: 'vcpus',
		label: 'vCPUs',
		unit: 'vCPU',
		maximum: MACHINE_OFFER_LIMITS.MAXIMUM_VCPUS,
	},
	{
		key: 'memoryGiB',
		label: 'Memory',
		unit: 'GiB',
		maximum: MACHINE_OFFER_LIMITS.MAXIMUM_MEMORY_GIB,
	},
	{
		key: 'diskGiB',
		label: 'Disk',
		unit: 'GiB',
		maximum: MACHINE_OFFER_LIMITS.MAXIMUM_DISK_GIB,
	},
] as const satisfies readonly {
	key: OfferField;
	label: string;
	unit: string;
	maximum: number;
}[];

const CLOCK_DIGITS = 2;
const CLOCK_PATTERN = /^(\d{2}):(\d{2})$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;

function pad(value: number): string {
	return value.toString().padStart(CLOCK_DIGITS, '0');
}

function minutesToClock(minutes: number): string {
	return `${pad(Math.floor(minutes / MINUTES_PER_HOUR))}:${pad(minutes % MINUTES_PER_HOUR)}`;
}

function clockToMinutes(clock: string): number | null {
	const match = CLOCK_PATTERN.exec(clock);
	if (!(match?.[1] && match[2])) return null;
	const minutes = Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
	return minutes < MINUTES_PER_DAY ? minutes : null;
}

function wholeNumber(value: string): number | null {
	const trimmed = value.trim();
	return WHOLE_NUMBER_PATTERN.test(trimmed) ? Number(trimmed) : null;
}

function inRange(value: number | null, minimum: number, maximum: number) {
	return value !== null && value >= minimum && value <= maximum;
}

function formatMaintenanceWindow(
	maintenance: MachineMaintenanceWindow
): string {
	const end =
		(maintenance.startMinuteUtc + maintenance.durationMinutes) %
		MINUTES_PER_DAY;
	return `${minutesToClock(maintenance.startMinuteUtc)} to ${minutesToClock(end)} UTC`;
}

export const DEFAULT_MAINTENANCE_WINDOW_LABEL = formatMaintenanceWindow(
	DEFAULT_MAINTENANCE_WINDOW
);

export const DEFAULT_WINDOW_START_LABEL = formatTimeLabel(
	minutesToClock(DEFAULT_MAINTENANCE_WINDOW.startMinuteUtc)
);

export const DEFAULT_UNCLAIMED_FLOAT_AMOUNT = formatMicroUsdAmount(
	UNCLAIMED_FLOAT_LIMITS.DEFAULT_BASE_UNITS.toString()
);

export const DEFAULT_UNCLAIMED_FLOAT_LABEL = `${DEFAULT_UNCLAIMED_FLOAT_AMOUNT} USDC`;

export function hostSettingsDraft(
	settings: MachineHostSettings
): HostSettingsDraft {
	const maintenance = settings.maintenanceWindow ?? DEFAULT_MAINTENANCE_WINDOW;
	return {
		customWindow: settings.maintenanceWindow !== null,
		windowStart: minutesToClock(maintenance.startMinuteUtc),
		windowDuration: String(maintenance.durationMinutes),
		vcpus: settings.offer.vcpus?.toString() ?? '',
		memoryGiB: settings.offer.memoryGiB?.toString() ?? '',
		diskGiB: settings.offer.diskGiB?.toString() ?? '',
		maxUnclaimedFloat:
			settings.maxUnclaimedFloat === null
				? ''
				: formatMicroUsdAmount(settings.maxUnclaimedFloat),
	};
}

function floatError(value: string): string | undefined {
	if (value.trim() === '') return undefined;
	const baseUnits = usdInputToMicroUsd(value);
	if (baseUnits === null) return 'Enter a USDC amount, like 25 or 12.50.';
	return BigInt(baseUnits) > UNCLAIMED_FLOAT_LIMITS.MAXIMUM_BASE_UNITS
		? `Use at most ${formatMicroUsdAmount(UNCLAIMED_FLOAT_LIMITS.MAXIMUM_BASE_UNITS.toString())} USDC.`
		: undefined;
}

export function hostSettingsErrors(
	draft: HostSettingsDraft
): HostSettingsErrors {
	const errors: HostSettingsErrors = {};
	const { MINIMUM_DURATION_MINUTES, MAXIMUM_DURATION_MINUTES } =
		MAINTENANCE_WINDOW_LIMITS;
	if (draft.customWindow && clockToMinutes(draft.windowStart) === null) {
		errors.windowStart = 'Pick a start time.';
	}
	if (
		draft.customWindow &&
		!inRange(
			wholeNumber(draft.windowDuration),
			MINIMUM_DURATION_MINUTES,
			MAXIMUM_DURATION_MINUTES
		)
	) {
		errors.windowDuration = `Use ${MINIMUM_DURATION_MINUTES} to ${MAXIMUM_DURATION_MINUTES} minutes.`;
	}
	for (const { key, unit, maximum } of OFFER_FIELDS) {
		const value = draft[key];
		if (
			value.trim() !== '' &&
			!inRange(wholeNumber(value), MACHINE_OFFER_LIMITS.MINIMUM, maximum)
		) {
			errors[key] =
				`Use ${MACHINE_OFFER_LIMITS.MINIMUM} to ${formatCount(maximum)} ${unit}.`;
		}
	}
	const float = floatError(draft.maxUnclaimedFloat);
	if (float) errors.maxUnclaimedFloat = float;
	return errors;
}

function maintenanceWindow(
	draft: HostSettingsDraft
): MachineMaintenanceWindow | null {
	const startMinuteUtc = clockToMinutes(draft.windowStart);
	const durationMinutes = wholeNumber(draft.windowDuration);
	if (
		!draft.customWindow ||
		startMinuteUtc === null ||
		durationMinutes === null
	)
		return null;
	return { startMinuteUtc, durationMinutes };
}

export function toHostSettings(draft: HostSettingsDraft): MachineHostSettings {
	return {
		maintenanceWindow: maintenanceWindow(draft),
		offer: {
			vcpus: wholeNumber(draft.vcpus),
			memoryGiB: wholeNumber(draft.memoryGiB),
			diskGiB: wholeNumber(draft.diskGiB),
		},
		maxUnclaimedFloat: usdInputToMicroUsd(draft.maxUnclaimedFloat),
	};
}
