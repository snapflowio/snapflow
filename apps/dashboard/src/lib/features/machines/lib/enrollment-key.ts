/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MachineEnrollmentKey } from '@snapflow/api-client';
import type { StatusBadge } from '#lib/components/ui/status-badge.ts';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';

export const EnrollmentKeyKind = {
	Single: 'single',
	Fleet: 'fleet',
} as const;

export type EnrollmentKeyKind =
	(typeof EnrollmentKeyKind)[keyof typeof EnrollmentKeyKind];

export const ENROLLMENT_KEY_KIND_OPTIONS = [
	{ value: EnrollmentKeyKind.Single, label: 'One machine' },
	{ value: EnrollmentKeyKind.Fleet, label: 'Fleet' },
] as const;

const ONE_DAY_SECONDS = '86400';
const SEVEN_DAYS_SECONDS = '604800';
const THIRTY_DAYS_SECONDS = '2592000';
const NINETY_DAYS_SECONDS = '7776000';

export const FLEET_LIFETIME_OPTIONS = [
	{ value: ONE_DAY_SECONDS, label: '1 day' },
	{ value: SEVEN_DAYS_SECONDS, label: '7 days' },
	{ value: THIRTY_DAYS_SECONDS, label: '30 days' },
	{ value: NINETY_DAYS_SECONDS, label: '90 days' },
] as const;

export type FleetLifetime = (typeof FLEET_LIFETIME_OPTIONS)[number]['value'];

export const DEFAULT_FLEET_LIFETIME: FleetLifetime = SEVEN_DAYS_SECONDS;

export const ENROLLMENT_KEY_NAME_MAX_LENGTH = 64;

const ENROLLMENT_KEY_BADGES = {
	used: { label: 'Used', variant: 'neutral' },
	disabled: { label: 'Disabled', variant: 'neutral' },
	expired: { label: 'Expired', variant: 'error' },
	active: { label: 'Active', variant: 'success' },
} as const satisfies Record<string, StatusBadge>;

export function enrollmentKeyBadge(
	key: MachineEnrollmentKey,
	now: number
): StatusBadge {
	if (!key.enabled) {
		return key.singleUse && key.lastUsedAt
			? ENROLLMENT_KEY_BADGES.used
			: ENROLLMENT_KEY_BADGES.disabled;
	}
	if (key.expiresAt && new Date(key.expiresAt).getTime() <= now) {
		return ENROLLMENT_KEY_BADGES.expired;
	}
	return ENROLLMENT_KEY_BADGES.active;
}

export function enrollmentKeyKindLabel(key: MachineEnrollmentKey): string {
	return key.singleUse ? 'One machine' : 'Fleet';
}

const DEFAULT_KEY_NAME_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
});

export function defaultEnrollmentKeyName(now: Date): string {
	return `Added ${DEFAULT_KEY_NAME_FORMAT.format(now)}`;
}
