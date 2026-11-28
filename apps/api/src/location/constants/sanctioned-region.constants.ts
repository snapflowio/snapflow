/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SANCTIONED_COUNTRIES: ReadonlySet<string> = new Set([
	'CU',
	'IR',
	'KP',
	'SY',
]);

const OCCUPIED_UKRAINIAN_REGIONS: ReadonlySet<string> = new Set([
	'Crimea',
	'Sevastopol',
	'Donetsk',
	'Luhansk',
]);

export const SANCTIONED_SUBDIVISIONS: ReadonlyMap<
	string,
	ReadonlySet<string>
> = new Map([
	['UA', OCCUPIED_UKRAINIAN_REGIONS],
	['RU', OCCUPIED_UKRAINIAN_REGIONS],
]);

export const LocationErrorCode = {
	SANCTIONED_REGION: 'sanctioned_region',
} as const;

export const SANCTIONED_REGION_MESSAGE =
	'Snapflow is not available in comprehensively sanctioned countries and regions.';
