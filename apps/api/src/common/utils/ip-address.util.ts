/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BlockList, isIP } from 'node:net';
import {
	HOST_URL_PREFIX,
	IP_FAMILY,
	IP_VERSION_FAMILY,
	IPV6_HOST_BRACKETS,
	type IpFamily,
	LOCAL_HOSTNAME,
	NON_PUBLIC_HOSTNAME_SUFFIXES,
	NON_PUBLIC_NETWORKS,
} from '../constants/ip-network.constants';

const IPV4_MAPPED_IPV6_PREFIX = '::ffff:';

const NON_PUBLIC_ADDRESSES = NON_PUBLIC_NETWORKS.reduce((list, network) => {
	list.addSubnet(network.address, network.prefix, network.family);
	return list;
}, new BlockList());

export function unmappedIpAddress(address: string): string {
	return address.startsWith(IPV4_MAPPED_IPV6_PREFIX)
		? address.slice(IPV4_MAPPED_IPV6_PREFIX.length)
		: address;
}

export function ipFamily(address: string): IpFamily | undefined {
	return IP_VERSION_FAMILY.get(isIP(address));
}

export function publicIpv4Address(address: string | undefined): string | null {
	if (!address) return null;
	const unmapped = unmappedIpAddress(address);
	return ipFamily(unmapped) === IP_FAMILY.V4 && isPublicIpAddress(unmapped)
		? unmapped
		: null;
}

function hostnameOf(host: string): string | null {
	if (!URL.canParse(`${HOST_URL_PREFIX}${host}`)) return null;
	return new URL(`${HOST_URL_PREFIX}${host}`).hostname
		.replace(IPV6_HOST_BRACKETS, '')
		.toLowerCase();
}

export function isPublicHost(host: string): boolean {
	const hostname = hostnameOf(host);
	if (!hostname) return false;
	if (ipFamily(hostname)) return isPublicIpAddress(unmappedIpAddress(hostname));
	return (
		hostname !== LOCAL_HOSTNAME &&
		hostname.includes('.') &&
		!NON_PUBLIC_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
	);
}

export function isPublicIpAddress(address: string): boolean {
	const family = ipFamily(address);
	return family !== undefined && !NON_PUBLIC_ADDRESSES.check(address, family);
}
