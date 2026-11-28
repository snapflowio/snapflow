/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isIP } from 'node:net';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const LOOPBACK_HOSTNAMES = new Set(['localhost', '::1']);
const IPV4_FAMILY = 4;
const IPV4_LOOPBACK_FIRST_OCTET = '127';

export function parseVaultProxyUrl(
	value: string,
	requireLoopback: boolean
): URL {
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error('SNAPFLOW_VAULT_PROXY_URL is not a valid URL');
	}
	if (
		!HTTP_PROTOCOLS.has(parsed.protocol) ||
		parsed.username ||
		parsed.password ||
		parsed.search ||
		parsed.hash
	) {
		throw new Error(
			'SNAPFLOW_VAULT_PROXY_URL must be an http(s) URL without credentials, a query or a fragment'
		);
	}
	if (requireLoopback && !isLoopbackHostname(parsed.hostname)) {
		throw new Error(
			'SNAPFLOW_VAULT_PROXY_URL must be a loopback Vault Proxy in hosted deployments'
		);
	}
	return parsed;
}

function isLoopbackHostname(hostname: string): boolean {
	const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
	if (LOOPBACK_HOSTNAMES.has(normalized)) return true;
	return (
		isIP(normalized) === IPV4_FAMILY &&
		normalized.split('.')[0] === IPV4_LOOPBACK_FIRST_OCTET
	);
}
