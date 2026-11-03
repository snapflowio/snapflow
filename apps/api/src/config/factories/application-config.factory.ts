/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { BUILD_PROVENANCE } from '../constants/build-provenance.constants';
import type { LogLevel } from '../environment/namespaces/observability.environment';
import type { ConfigurationInput } from '../types/configuration-input.types';
import { createTrustedWebOrigins } from '../utils/trusted-web-origins.util';

const SECURE_ORIGIN_PREFIX = 'https://';
const DASHBOARD_PATH = '/dashboard';
const REQUEST_LOG_LEVELS: ReadonlySet<LogLevel> = new Set(['trace', 'debug']);

function oauthApplication(
	clientId: string | undefined,
	clientSecret: string | undefined
): { clientId: string; clientSecret: string } | undefined {
	return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

export function createApplicationConfig({
	values,
	profile,
}: ConfigurationInput) {
	const apiUrl = values.API_URL;
	const websiteUrl = values.WEBSITE_URL;
	const adminUrl = values.ADMIN_URL;
	if (
		profile.hosted &&
		![apiUrl, websiteUrl, adminUrl].every((url) =>
			url?.startsWith(SECURE_ORIGIN_PREFIX)
		)
	) {
		throw new Error(
			`API_URL, WEBSITE_URL and ADMIN_URL must use HTTPS in ${profile.name}`
		);
	}
	const authBaseUrl = apiUrl ?? `http://localhost:${values.PORT}`;
	const dashboardUrl = adminUrl ? `${adminUrl}${DASHBOARD_PATH}` : undefined;
	const developerOrigins = !profile.hosted;
	const trustedBrowserOrigins = createTrustedWebOrigins(
		[websiteUrl, dashboardUrl, adminUrl],
		developerOrigins
	);
	return {
		deployment: profile,
		version: BUILD_PROVENANCE.version,
		port: values.PORT,
		apiUrl,
		authBaseUrl,
		websiteUrl,
		adminUrl,
		dashboardUrl,
		trustedBrowserOrigins,
		trustedWebOrigins: createTrustedWebOrigins(
			[websiteUrl, dashboardUrl, adminUrl, authBaseUrl],
			developerOrigins
		),
		betterAuthSecrets: values.BETTER_AUTH_SECRETS,
		passkeyRpId: websiteUrl ? new URL(websiteUrl).hostname : undefined,
		trustedProxyCidrs: values.SNAPFLOW_TRUSTED_PROXY_CIDRS,
		development: {
			edgeEnrollmentSecret: values.SNAPFLOW_DEVELOPMENT_EDGE_ENROLLMENT_SECRET,
			machineEnrollmentSecret:
				values.SNAPFLOW_DEVELOPMENT_MACHINE_ENROLLMENT_SECRET,
		},
		socialSignIn: {
			google: oauthApplication(
				values.GOOGLE_CLIENT_ID,
				values.GOOGLE_CLIENT_SECRET
			),
			github: oauthApplication(
				values.GITHUB_CLIENT_ID,
				values.GITHUB_CLIENT_SECRET
			),
		},
		stripe: {
			secretKey: values.STRIPE_SECRET_KEY,
			publishableKey: values.STRIPE_PUBLISHABLE_KEY,
			platformWebhookSecret: values.STRIPE_PLATFORM_WEBHOOK_SECRET,
			connectWebhookSecret: values.STRIPE_CONNECT_WEBHOOK_SECRET,
		},
		audit: { consoleLogEnabled: profile.developerConsole },
		log: {
			level: values.LOG_LEVEL,
			requests: { enabled: REQUEST_LOG_LEVELS.has(values.LOG_LEVEL) },
			pretty: profile.developerConsole,
		},
	};
}
