/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(...inputs));
}

export function formatDate(input: string | number): string {
	return new Date(input).toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	});
}

export function getRelativeTimeString(
	timestamp: string | Date | null | undefined,
	fallback = '-'
): { date: Date; relativeTimeString: string } {
	if (!timestamp) return { date: new Date(), relativeTimeString: fallback };

	let date: Date;
	if (timestamp instanceof Date) {
		date = timestamp;
	} else {
		date = new Date(timestamp);
		if (Number.isNaN(date.getTime()))
			return { date: new Date(), relativeTimeString: fallback };
	}

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const isFuture = diffMs < 0;
	const absDiffMs = Math.abs(diffMs);

	const minute = 60 * 1000;
	const hour = 60 * minute;
	const day = 24 * hour;
	const year = 365 * day;

	let relativeTimeString: string;

	if (absDiffMs < minute) {
		relativeTimeString = isFuture ? 'shortly' : 'just now';
	} else if (absDiffMs < hour) {
		const m = Math.floor(absDiffMs / minute);
		relativeTimeString = isFuture ? `in ${m}m` : `${m}m ago`;
	} else if (absDiffMs < day) {
		const h = Math.floor(absDiffMs / hour);
		relativeTimeString = isFuture ? `in ${h}h` : `${h}h ago`;
	} else if (absDiffMs < year) {
		const d = Math.floor(absDiffMs / day);
		relativeTimeString = isFuture ? `in ${d}d` : `${d}d ago`;
	} else {
		const y = Math.floor(absDiffMs / year);
		relativeTimeString = isFuture ? `in ${y}y` : `${y}y ago`;
	}

	return { date, relativeTimeString };
}

export function capitalize(value: string): string {
	if (!value) return value;
	return value[0].toUpperCase() + value.slice(1);
}

export function getMaskedApiKey(key: string): string {
	if (key.length <= 6) return '*'.repeat(key.length);
	return `${key.slice(0, 3)}${'*'.repeat(Math.max(0, key.length - 6))}${key.slice(-3)}`;
}
