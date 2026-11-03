/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isIPv4, isIPv6 } from 'node:net';

const PREFIX_SEPARATOR = '/';
const IPV4_SEPARATOR = '.';
const IPV6_SEPARATOR = ':';
const IPV6_ELISION = '::';
const IPV4_BYTES = 4;
const IPV6_GROUPS = 8;
const BITS_PER_BYTE = 8;
const BYTES_PER_IPV6_GROUP = 2;
const HEXADECIMAL = 16;
const BYTE_MASK = 0xff;
const IP_VERSION_4 = 4;
const IP_VERSION_6 = 6;
const DECIMAL_PREFIX_PATTERN = /^\d{1,3}$/;

function ipv4Bytes(address: string): number[] {
	return address.split(IPV4_SEPARATOR).map(Number);
}

function ipv6Bytes(address: string): number[] {
	const [head, tail] = address.includes(IPV6_ELISION)
		? address.split(IPV6_ELISION)
		: [address, null];
	const groups = (part: string): number[] =>
		part === ''
			? []
			: part.split(IPV6_SEPARATOR).flatMap((group) => {
					if (isIPv4(group)) return ipv4Bytes(group);
					const value = Number.parseInt(group, HEXADECIMAL);
					return [value >> BITS_PER_BYTE, value & BYTE_MASK];
				});
	const leading = groups(head);
	const trailing = tail === null ? [] : groups(tail);
	const elided =
		IPV6_GROUPS * BYTES_PER_IPV6_GROUP - leading.length - trailing.length;
	return [...leading, ...new Array<number>(elided).fill(0), ...trailing];
}

export function parseIpNetwork(value: string): string {
	const [address, prefix, ...extra] = value.split(PREFIX_SEPARATOR);
	const bytes = isIPv4(address)
		? ipv4Bytes(address)
		: isIPv6(address)
			? ipv6Bytes(address)
			: null;
	const bits = Number(prefix);
	if (
		!bytes ||
		extra.length > 0 ||
		!DECIMAL_PREFIX_PATTERN.test(prefix ?? '') ||
		bits > bytes.length * BITS_PER_BYTE
	) {
		throw new Error(`${value} is not an address/prefix network`);
	}
	bytes.forEach((byte, index) => {
		const networkBits = Math.min(
			Math.max(bits - index * BITS_PER_BYTE, 0),
			BITS_PER_BYTE
		);
		const hostMask = BYTE_MASK >> networkBits;
		if ((byte & hostMask) !== 0) {
			throw new Error(`${value} has host bits set; use its network address`);
		}
	});
	const version = bytes.length === IPV4_BYTES ? IP_VERSION_4 : IP_VERSION_6;
	return `${version}:${bytes.join(IPV4_SEPARATOR)}/${bits}`;
}
