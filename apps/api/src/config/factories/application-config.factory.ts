/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import { type Address, isAddressEqual } from 'viem';
import { BUILD_PROVENANCE } from '../constants/build-provenance.constants';
import { SETTLEMENT_CHAIN_ID } from '../constants/settlement-chain.constants';
import type { LogLevel } from '../environment/namespaces/observability.environment';
import type { ConfigurationInput } from '../types/configuration-input.types';
import { passkeyRpId } from '../utils/passkey-rp-id.util';
import { createTrustedWebOrigins } from '../utils/trusted-web-origins.util';

const SECURE_ORIGIN_PREFIX = 'https://';

function ethUsdPriceSource(
	feedAddress: Address | undefined,
	fixedPriceUsd: number | undefined
) {
	if (feedAddress !== undefined) {
		return { feedAddress, fixedPriceUsd: null };
	}
	if (fixedPriceUsd !== undefined) {
		return { feedAddress: null, fixedPriceUsd };
	}
	throw new Error(
		'Set SETTLEMENT_ETH_USD_FEED_ADDRESS, or SETTLEMENT_ETH_USD_PRICE in development, so relay fees can be priced'
	);
}

function feeReceiverAddress(feeReceiver: Address, relayer: Address): Address {
	if (isAddressEqual(feeReceiver, relayer)) {
		throw new Error(
			'SETTLEMENT_FEE_RECEIVER_ADDRESS must differ from SETTLEMENT_RELAYER_ADDRESS'
		);
	}
	return feeReceiver;
}
const DASHBOARD_PATH = '/dashboard';
const OAUTH_ENVIRONMENT_PREFIX = {
	GOOGLE: 'GOOGLE',
	GITHUB: 'GITHUB',
} as const;
const REQUEST_LOG_LEVELS: ReadonlySet<LogLevel> = new Set(['trace', 'debug']);

function oauthApplication(
	provider: string,
	clientId: string | undefined,
	clientSecret: string | undefined
): { clientId: string; clientSecret: string } | undefined {
	if (clientId === undefined && clientSecret === undefined) return undefined;
	if (clientId === undefined || clientSecret === undefined) {
		throw new Error(
			`${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET must be set together`
		);
	}
	return { clientId, clientSecret };
}

function productAnalytics(
	projectKey: string | undefined,
	host: string | undefined
): { projectKey: string; host: string } | undefined {
	if (projectKey === undefined && host === undefined) {
		return undefined;
	}
	if (!projectKey || !host) {
		throw new Error(
			'POSTHOG_PROJECT_KEY and POSTHOG_HOST must be set together'
		);
	}
	return { projectKey, host };
}

function receiptIssuer(
	name: string | undefined,
	address: string | undefined,
	email: string | undefined,
	taxId: string | undefined
) {
	if (name === undefined && address === undefined && email === undefined) {
		return null;
	}
	if (!name || !address || !email) {
		throw new Error(
			'RECEIPT_ISSUER_NAME, RECEIPT_ISSUER_ADDRESS and RECEIPT_ISSUER_EMAIL must be set together'
		);
	}
	return { name, address, email, taxId: taxId ?? null };
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
	if (
		profile.hosted &&
		values.SETTLEMENT_CHAIN_ID === SETTLEMENT_CHAIN_ID.LOCAL
	) {
		throw new Error(
			`SETTLEMENT_CHAIN_ID must not be the local chain in ${profile.name}`
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
		analytics: productAnalytics(
			values.POSTHOG_PROJECT_KEY,
			values.POSTHOG_HOST
		),
		betterAuthSecrets: values.BETTER_AUTH_SECRETS,
		humanVerification: {
			siteKey: values.TURNSTILE_SITE_KEY,
			secretKey: values.TURNSTILE_SECRET_KEY,
		},
		passkeyRpId: websiteUrl ? passkeyRpId(websiteUrl) : undefined,
		trustedProxyCidrs: values.SNAPFLOW_TRUSTED_PROXY_CIDRS,
		development: {
			edgeEnrollmentSecret: values.SNAPFLOW_DEVELOPMENT_EDGE_ENROLLMENT_SECRET,
			machineEnrollmentSecret:
				values.SNAPFLOW_DEVELOPMENT_MACHINE_ENROLLMENT_SECRET,
		},
		socialSignIn: {
			google: oauthApplication(
				OAUTH_ENVIRONMENT_PREFIX.GOOGLE,
				values.GOOGLE_CLIENT_ID,
				values.GOOGLE_CLIENT_SECRET
			),
			github: oauthApplication(
				OAUTH_ENVIRONMENT_PREFIX.GITHUB,
				values.GITHUB_CLIENT_ID,
				values.GITHUB_CLIENT_SECRET
			),
		},
		settlement: {
			chainId: values.SETTLEMENT_CHAIN_ID,
			rpcUrl: values.SETTLEMENT_RPC_URL,
			escrowAddress: values.SETTLEMENT_ESCROW_ADDRESS,
			escrowDeploymentBlock: values.SETTLEMENT_ESCROW_DEPLOYMENT_BLOCK,
			logBlockRange: values.SETTLEMENT_LOG_BLOCK_RANGE,
			indexerRangesPerRun: values.SETTLEMENT_INDEXER_RANGES_PER_RUN,
			usdcAddress: values.SETTLEMENT_USDC_ADDRESS,
			relayerAddress: values.SETTLEMENT_RELAYER_ADDRESS,
			feeReceiverAddress: feeReceiverAddress(
				values.SETTLEMENT_FEE_RECEIVER_ADDRESS,
				values.SETTLEMENT_RELAYER_ADDRESS
			),
			relayerPrivateKey: values.SETTLEMENT_RELAYER_PRIVATE_KEY,
			alertmanagerUrl: values.SETTLEMENT_ALERTMANAGER_URL ?? null,
			ethUsdPrice: ethUsdPriceSource(
				values.SETTLEMENT_ETH_USD_FEED_ADDRESS,
				values.SETTLEMENT_ETH_USD_PRICE
			),
			sanctionsListUrl: values.SANCTIONS_LIST_URL,
			walletConnectProjectId: values.WALLETCONNECT_PROJECT_ID ?? null,
		},
		receipts: {
			issuer: receiptIssuer(
				values.RECEIPT_ISSUER_NAME,
				values.RECEIPT_ISSUER_ADDRESS,
				values.RECEIPT_ISSUER_EMAIL,
				values.RECEIPT_ISSUER_TAX_ID
			),
		},
		audit: { consoleLogEnabled: profile.developerConsole },
		log: {
			level: values.LOG_LEVEL,
			requests: { enabled: REQUEST_LOG_LEVELS.has(values.LOG_LEVEL) },
			pretty: profile.developerConsole,
		},
	};
}
