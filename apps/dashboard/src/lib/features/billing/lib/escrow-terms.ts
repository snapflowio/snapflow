/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isAddress, isAddressEqual, zeroAddress } from 'viem';
import { shortAddress } from '#lib/features/wallet/lib/payment-wallet.ts';
import { formatDurationMinutes } from './format.ts';

const ANY_HOST_LABEL = 'Any host';

export function signerHostLabel(host: string | null): string {
	if (host === null) return ANY_HOST_LABEL;
	return isAddress(host) && isAddressEqual(host, zeroAddress)
		? ANY_HOST_LABEL
		: shortAddress(host);
}

export const SECONDS_PER_HOUR = 3_600n;
const SECONDS_PER_MINUTE = 60n;
const MILLISECONDS_PER_SECOND = 1_000;

export function hourlyMicroUsd(perSecond: string | bigint): string {
	return (BigInt(perSecond) * SECONDS_PER_HOUR).toString();
}

export function perSecondMicroUsd(perHour: bigint): bigint {
	return (perHour + SECONDS_PER_HOUR - 1n) / SECONDS_PER_HOUR;
}

export function formatSeconds(seconds: number | bigint): string {
	return formatDurationMinutes(
		(BigInt(seconds) / SECONDS_PER_MINUTE).toString()
	);
}

export function unixSecondsDate(seconds: string | bigint): Date {
	return new Date(Number(BigInt(seconds)) * MILLISECONDS_PER_SECOND);
}

export function dateUnixSeconds(value: string | number): bigint {
	return BigInt(
		Math.floor(new Date(value).getTime() / MILLISECONDS_PER_SECOND)
	);
}

export function formatRemaining(seconds: number): string {
	return formatDurationMinutes(
		String(Math.max(1, Math.ceil(seconds / Number(SECONDS_PER_MINUTE))))
	);
}
