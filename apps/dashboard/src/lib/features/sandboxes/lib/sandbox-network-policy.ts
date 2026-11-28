/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';

export const MINIMUM_EGRESS_BANDWIDTH_BPS = 524_288;
export const MAXIMUM_EGRESS_BANDWIDTH_BPS = 32_000_000_000;
const MAX_NETWORK_ALLOW_LIST_ENTRIES = 10;
const MAX_DOMAIN_ALLOW_LIST_ENTRIES = 64;

const ALLOW_LIST_SEPARATOR = ',';
const CIDR_SEPARATOR = '/';
const CIDR_SEGMENT_COUNT = 2;
const IPV4_SEPARATOR = '.';
const IPV4_OCTET_COUNT = 4;
const IPV4_ADDRESS_BITS = 32;
const IPV4_OCTET_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const CIDR_PREFIX_PATTERN = /^\d{1,2}$/;
const DOMAIN_PATTERN =
	/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const NETWORK_BLOCK_ALL_CONFLICT_MESSAGE =
	'Allow outbound internet access to use an allow list';

export function splitAllowList(value: string): string[] {
	return value
		.split(ALLOW_LIST_SEPARATOR)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export function normalizeAllowList(value: string): string | undefined {
	const entries = splitAllowList(value);
	return entries.length > 0 ? entries.join(ALLOW_LIST_SEPARATOR) : undefined;
}

function isIpv4Cidr(entry: string): boolean {
	const segments = entry.split(CIDR_SEPARATOR);
	if (segments.length !== CIDR_SEGMENT_COUNT) return false;
	const [address = '', prefix = ''] = segments;
	const octets = address.split(IPV4_SEPARATOR);
	return (
		CIDR_PREFIX_PATTERN.test(prefix) &&
		Number(prefix) <= IPV4_ADDRESS_BITS &&
		octets.length === IPV4_OCTET_COUNT &&
		octets.every((octet) => IPV4_OCTET_PATTERN.test(octet))
	);
}

const allowListSchema = ({
	entryLabel,
	isValidEntry,
	label,
	maxEntries,
}: {
	entryLabel: string;
	isValidEntry: (entry: string) => boolean;
	label: string;
	maxEntries: number;
}) =>
	z.string().superRefine((value, context) => {
		const entries = splitAllowList(value);
		const invalidEntry = entries.find((entry) => !isValidEntry(entry));
		if (invalidEntry !== undefined) {
			context.addIssue({
				code: 'custom',
				message: `"${invalidEntry}" is not a valid ${entryLabel}`,
			});
		}
		if (entries.length > maxEntries) {
			context.addIssue({
				code: 'custom',
				message: `${label} cannot contain more than ${maxEntries} entries`,
			});
		}
	});

export const networkAllowListSchema = allowListSchema({
	entryLabel: 'IPv4 CIDR, such as 8.8.8.0/24',
	isValidEntry: isIpv4Cidr,
	label: 'CIDR allow list',
	maxEntries: MAX_NETWORK_ALLOW_LIST_ENTRIES,
});

export const domainAllowListSchema = allowListSchema({
	entryLabel: 'domain name, such as github.com',
	isValidEntry: (entry) => DOMAIN_PATTERN.test(entry),
	label: 'Domain allow list',
	maxEntries: MAX_DOMAIN_ALLOW_LIST_ENTRIES,
});
