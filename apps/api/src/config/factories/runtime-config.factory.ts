/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ConfigurationInput } from '../types/configuration-input.types';
import { assertSeparateSandboxSite } from '../utils/sandbox-site.util';

const SECURE_PROTOCOL = 'https:';
const LOOPBACK_TOP_LEVEL_DOMAIN = 'localhost';

function isLoopbackDomain(domain: string): boolean {
	return (
		domain === LOOPBACK_TOP_LEVEL_DOMAIN ||
		domain.endsWith(`.${LOOPBACK_TOP_LEVEL_DOMAIN}`)
	);
}

export function createRuntimeConfig({ values, profile }: ConfigurationInput) {
	const platformDomain = values.SNAPFLOW_PLATFORM_DOMAIN;
	if (profile.hosted && platformDomain) {
		if (isLoopbackDomain(platformDomain)) {
			throw new Error(
				`SNAPFLOW_PLATFORM_DOMAIN must be a public domain in ${profile.name}`
			);
		}
		assertSeparateSandboxSite(platformDomain, {
			API_URL: values.API_URL,
			ADMIN_URL: values.ADMIN_URL,
			WEBSITE_URL: values.WEBSITE_URL,
		});
	}
	let edgePublicOrigin: string | undefined;
	if (platformDomain) {
		const origin = new URL(`${SECURE_PROTOCOL}//${platformDomain}`);
		if (values.SNAPFLOW_EDGE_HTTPS_PORT !== undefined) {
			origin.port = String(values.SNAPFLOW_EDGE_HTTPS_PORT);
		}
		edgePublicOrigin = origin.origin;
	}
	return {
		networking: {
			edgePublicOrigin,
			edgeGuestOrigin: values.SNAPFLOW_EDGE_GUEST_ORIGIN,
			platformDomain,
		},
		healthCheck: { apiKey: values.HEALTH_CHECK_API_KEY },
	};
}
