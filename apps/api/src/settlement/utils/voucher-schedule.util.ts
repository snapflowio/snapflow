/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_SECOND,
} from '../../common/constants/time.constants';
import type { SettingsSnapshot } from '../../settings/types/settings.types';

type CoverageSettings = Pick<
	SettingsSnapshot,
	'voucherIntervalSeconds' | 'voucherGraceIntervals'
>;

// A voucher is reissued once half its lifetime has passed, so a host always
// holds one that stays claimable for at least that long.
const REISSUE_LIFETIME_DIVISOR = 2;

// True once a lease went more than its grace intervals without a signed
// voucher covering what it owed.
export function voucherCoverageLapsed(
	coveredAt: Date,
	now: Date,
	settings: CoverageSettings
): boolean {
	const graceMilliseconds =
		settings.voucherIntervalSeconds *
		settings.voucherGraceIntervals *
		MILLISECONDS_PER_SECOND;
	return now.getTime() - coveredAt.getTime() > graceMilliseconds;
}

// The expiry of a voucher issued now, in whole seconds as the escrow reads
// it, and never after the session key meant to sign it expires.
export function voucherExpiry(
	now: Date,
	lifetimeHours: number,
	keyExpiresAt: Date | null
): Date {
	const lifetimeEnd = now.getTime() + lifetimeHours * MILLISECONDS_PER_HOUR;
	const end =
		keyExpiresAt === null
			? lifetimeEnd
			: Math.min(lifetimeEnd, keyExpiresAt.getTime());
	return new Date(
		Math.floor(end / MILLISECONDS_PER_SECOND) * MILLISECONDS_PER_SECOND
	);
}

export function voucherReissueDue(
	expiresAt: Date,
	now: Date,
	lifetimeHours: number
): boolean {
	return (
		expiresAt.getTime() - now.getTime() <=
		(lifetimeHours * MILLISECONDS_PER_HOUR) / REISSUE_LIFETIME_DIVISOR
	);
}

export function chainSeconds(date: Date): bigint {
	return BigInt(Math.floor(date.getTime() / MILLISECONDS_PER_SECOND));
}
