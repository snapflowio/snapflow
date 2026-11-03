/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxCapability, SandboxMode } from '@snapflow/api-client';

const DISABLED_AUTO_STOP_INTERVAL = 0;
const MAXIMUM_AUTO_ARCHIVE_INTERVAL = 0;
const HALF_HOUR_MINUTES = 30;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const FOUR_HOURS_IN_MINUTES = 240;
const EIGHT_HOURS_IN_MINUTES = 480;
const THREE_DAYS_IN_MINUTES = 4320;
const SEVEN_DAYS_IN_MINUTES = 10_080;
const FOURTEEN_DAYS_IN_MINUTES = 20_160;
const THIRTY_DAYS_IN_MINUTES = 43_200;
export const DEFAULT_AUTO_STOP_MINUTES = 15;
export const CREATE_SANDBOX_STEPS = [
	{ key: 'workload', label: 'New sandbox' },
	{ key: 'runtime', label: 'Lifecycle and network' },
	{ key: 'configuration', label: 'Environment and storage' },
	{ key: 'review', label: 'Review' },
] as const;

export const AUTO_STOP_OPTIONS = [
	{ label: 'Default — 15 minutes', value: '' },
	{ label: '30 minutes', value: String(HALF_HOUR_MINUTES) },
	{ label: '1 hour', value: String(MINUTES_PER_HOUR) },
	{ label: '4 hours', value: String(FOUR_HOURS_IN_MINUTES) },
	{ label: '8 hours', value: String(EIGHT_HOURS_IN_MINUTES) },
	{ label: 'Never', value: String(DISABLED_AUTO_STOP_INTERVAL) },
] as const;
export const AUTO_ARCHIVE_OPTIONS = [
	{ label: 'Default — 7 days', value: '' },
	{ label: '1 day', value: String(MINUTES_PER_DAY) },
	{ label: '3 days', value: String(THREE_DAYS_IN_MINUTES) },
	{ label: '14 days', value: String(FOURTEEN_DAYS_IN_MINUTES) },
	{ label: '30 days', value: String(THIRTY_DAYS_IN_MINUTES) },
	{
		label: 'Longest available retention',
		value: String(MAXIMUM_AUTO_ARCHIVE_INTERVAL),
	},
] as const;
export const AUTO_DELETE_OPTIONS = [
	{ label: 'Never (default)', value: '' },
	{ label: '1 day after stopping', value: String(MINUTES_PER_DAY) },
	{ label: '7 days after stopping', value: String(SEVEN_DAYS_IN_MINUTES) },
	{ label: '30 days after stopping', value: String(THIRTY_DAYS_IN_MINUTES) },
] as const;
export const MODE_OPTIONS = [
	{
		label: 'Temporary — deleted when stopped',
		value: SandboxMode.Ephemeral,
	},
	{
		label: 'Persistent — can be stopped and resumed',
		value: SandboxMode.Standard,
	},
];

export function formatDuration(
	value: string,
	defaultLabel: string,
	options: readonly { label: string; value: string }[]
): string {
	if (!value) return defaultLabel;
	const preset = options.find((option) => option.value === value);
	if (preset) return preset.label.replace(' (default)', '');
	return `${value} ${value === '1' ? 'minute' : 'minutes'}`;
}

const SANDBOX_CAPABILITY_LABELS: Record<SandboxCapability, string> = {
	[SandboxCapability.DeveloperTools]: 'Developer tools',
	[SandboxCapability.Desktop]: 'Desktop',
};
export const SANDBOX_CAPABILITY_OPTIONS = Object.values(SandboxCapability).map(
	(capability) => ({
		label: SANDBOX_CAPABILITY_LABELS[capability],
		value: capability,
	})
);

export function formatSandboxCapabilities(
	capabilities: readonly SandboxCapability[]
): string | undefined {
	return capabilities.length > 0
		? capabilities
				.map((capability) => SANDBOX_CAPABILITY_LABELS[capability])
				.join(', ')
		: undefined;
}
