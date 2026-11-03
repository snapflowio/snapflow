/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isIPv4 } from 'node:net';

const IPV4_ADDRESS_BITS = 32;
const IPV4_RADIX = 256;
const MAX_NETWORKS = 10;
const MAX_DOMAINS = 64;
const CIDR_PREFIX_PATTERN = /^\d{1,2}$/;

const PROTECTED_NETWORKS = [
	'0.0.0.0/8',
	'10.0.0.0/8',
	'100.64.0.0/10',
	'127.0.0.0/8',
	'169.254.0.0/16',
	'172.16.0.0/12',
	'192.0.0.0/24',
	'192.168.0.0/16',
	'192.0.2.0/24',
	'198.18.0.0/15',
	'198.51.100.0/24',
	'203.0.113.0/24',
	'224.0.0.0/4',
	'240.0.0.0/4',
] as const;

type IPv4Range = Readonly<{
	end: number;
	start: number;
}>;

function ipv4ToNumber(ipAddress: string): number {
	return ipAddress
		.split('.')
		.map(Number)
		.reduce((value, octet) => value * IPV4_RADIX + octet, 0);
}

function toIPv4Range(ipAddress: string, prefix: number): IPv4Range {
	const rangeSize = 2 ** (IPV4_ADDRESS_BITS - prefix);
	const start = Math.floor(ipv4ToNumber(ipAddress) / rangeSize) * rangeSize;

	return { end: start + rangeSize - 1, start };
}

function rangesOverlap(left: IPv4Range, right: IPv4Range): boolean {
	return left.start <= right.end && right.start <= left.end;
}

const protectedRanges = PROTECTED_NETWORKS.map((network) => {
	const [ipAddress, prefixLength] = network.split('/');
	return {
		network,
		range: toIPv4Range(ipAddress, Number(prefixLength)),
	};
});

export function validateNetworkAllowList(networkAllowList: string): void {
	const networks = networkAllowList.split(',').map((net: string) => net.trim());

	for (const network of networks) {
		if (!network) continue;

		const segments = network.split('/');
		const [ipAddress, prefixLength] = segments;

		if (!isIPv4(ipAddress)) {
			throw new Error(
				`Invalid IP address: "${ipAddress}" in network "${network}". Must be a valid IPv4 address`
			);
		}

		if (segments.length !== 2 || !prefixLength) {
			throw new Error(
				`Invalid network format: "${network}". Missing CIDR prefix length (e.g., /24)`
			);
		}

		const prefix = Number(prefixLength);
		if (
			!CIDR_PREFIX_PATTERN.test(prefixLength) ||
			prefix < 0 ||
			prefix > IPV4_ADDRESS_BITS
		) {
			throw new Error(
				`Invalid CIDR prefix length: ${network}. Prefix must be between 0 and ${IPV4_ADDRESS_BITS}`
			);
		}

		const networkRange = toIPv4Range(ipAddress, prefix);
		const protectedNetwork = protectedRanges.find(({ range }) =>
			rangesOverlap(networkRange, range)
		);
		if (protectedNetwork) {
			throw new Error(
				`Network allow-list entry "${network}" overlaps protected destination ${protectedNetwork.network}`
			);
		}
	}

	if (networks.length > MAX_NETWORKS) {
		throw new Error(
			`Network allow list cannot contain more than ${MAX_NETWORKS} networks`
		);
	}
}

export function validateDomainAllowList(domainAllowList: string): void {
	const domains = domainAllowList
		.split(',')
		.map((domain: string) => domain.trim());

	const domainRegex =
		/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

	for (const domain of domains) {
		if (!domain) continue;

		if (!domainRegex.test(domain)) {
			throw new Error(
				`Invalid domain: "${domain}". Must be a valid domain name`
			);
		}
	}

	if (domains.length > MAX_DOMAINS) {
		throw new Error(
			`Domain allow list cannot contain more than ${MAX_DOMAINS} domains`
		);
	}
}
