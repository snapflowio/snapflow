/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export function buildPlatformExposureUrl(
	edgePublicOrigin: string,
	exposureHostname: string
): URL {
	const url = new URL(edgePublicOrigin);
	url.hostname = exposureHostname;
	return url;
}

export function isSecurePublicOrigin(edgePublicOrigin: string): boolean {
	return new URL(edgePublicOrigin).protocol === 'https:';
}
