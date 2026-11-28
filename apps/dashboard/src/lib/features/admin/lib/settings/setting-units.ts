/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { formatBasisPointsPercent, formatMinutes } from '#lib/utils/format.ts';
import {
	formatMicroUsd,
	formatUsd,
	MICRO_USD_PER_CENT,
} from '#lib/utils/usd.ts';

export interface SettingUnit {
	readonly label: string;
	readonly format?: (value: number) => string;
}

const WHOLE_NUMBER_PATTERN = /^\d+$/;
const SECONDS_PER_MINUTE = 60;

function usdcFromCents(cents: number): string {
	return `${formatUsd((BigInt(cents) * MICRO_USD_PER_CENT).toString())} USDC`;
}

function percentOf(subject: string) {
	return (basisPoints: number) =>
		`${formatBasisPointsPercent(basisPoints)} of ${subject}`;
}

function secondsLabel(seconds: number): string {
	return seconds % SECONDS_PER_MINUTE === 0
		? formatMinutes(seconds / SECONDS_PER_MINUTE)
		: `${seconds} s`;
}

const BASIS_POINTS_LABEL = 'bps';

export const SETTING_UNITS = {
	gib: { label: 'GiB' },
	vcpus: { label: 'vCPUs' },
	count: { label: 'count' },
	blocks: { label: 'blocks' },
	days: { label: 'days' },
	hoursApart: { label: 'hours apart' },
	mbps: { label: 'Mbps' },
	mib: { label: 'MiB' },
	packetsPerSecond: { label: 'packets/s' },
	connectionsPerSecond: { label: 'connections/s' },
	connections: { label: 'connections' },
	iops: { label: 'IOPS' },
	mibPerSecond: { label: 'MiB/s' },
	voucherIntervals: { label: 'intervals' },
	minutes: { label: 'min', format: formatMinutes },
	seconds: { label: 's', format: secondsLabel },
	usdcCents: { label: 'cents', format: usdcFromCents },
	usdcCentsPerHour: {
		label: 'cents/h',
		format: (cents) => `${usdcFromCents(cents)} per hour`,
	},
	usdcCentsPerMonth: {
		label: 'cents/month',
		format: (cents) => `${usdcFromCents(cents)} per month`,
	},
	microUsdcPerGibMonth: {
		label: 'µUSDC/GiB-month',
		format: (microUsd) =>
			`${formatMicroUsd(String(microUsd))} USDC per GiB-month`,
	},
	basisPoints: { label: BASIS_POINTS_LABEL, format: formatBasisPointsPercent },
	basisPointsOfGas: {
		label: BASIS_POINTS_LABEL,
		format: percentOf('the gas cost'),
	},
	basisPointsOfHostPrice: {
		label: BASIS_POINTS_LABEL,
		format: percentOf('the host price'),
	},
	basisPointsOfMeasuredLinks: {
		label: BASIS_POINTS_LABEL,
		format: percentOf('the measured links'),
	},
} as const satisfies Record<string, SettingUnit>;

export function settingUnitPreview(
	unit: SettingUnit,
	value: string
): string | undefined {
	const trimmed = value.trim();
	if (!(unit.format && WHOLE_NUMBER_PATTERN.test(trimmed))) return undefined;
	return unit.format(Number(trimmed));
}
