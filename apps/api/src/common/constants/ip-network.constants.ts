/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const IP_FAMILY = {
	V4: 'ipv4',
	V6: 'ipv6',
} as const;

export type IpFamily = (typeof IP_FAMILY)[keyof typeof IP_FAMILY];

export const IP_VERSION_FAMILY: ReadonlyMap<number, IpFamily> = new Map([
	[4, IP_FAMILY.V4],
	[6, IP_FAMILY.V6],
]);

export const CIDR_SEPARATOR = '/';

export const NON_PUBLIC_NETWORKS: readonly {
	address: string;
	prefix: number;
	family: IpFamily;
}[] = [
	{ address: '0.0.0.0', prefix: 8, family: IP_FAMILY.V4 },
	{ address: '10.0.0.0', prefix: 8, family: IP_FAMILY.V4 },
	{ address: '100.64.0.0', prefix: 10, family: IP_FAMILY.V4 },
	{ address: '127.0.0.0', prefix: 8, family: IP_FAMILY.V4 },
	{ address: '169.254.0.0', prefix: 16, family: IP_FAMILY.V4 },
	{ address: '172.16.0.0', prefix: 12, family: IP_FAMILY.V4 },
	{ address: '192.0.0.0', prefix: 24, family: IP_FAMILY.V4 },
	{ address: '192.0.2.0', prefix: 24, family: IP_FAMILY.V4 },
	{ address: '192.88.99.0', prefix: 24, family: IP_FAMILY.V4 },
	{ address: '192.168.0.0', prefix: 16, family: IP_FAMILY.V4 },
	{ address: '198.18.0.0', prefix: 15, family: IP_FAMILY.V4 },
	{ address: '198.51.100.0', prefix: 24, family: IP_FAMILY.V4 },
	{ address: '203.0.113.0', prefix: 24, family: IP_FAMILY.V4 },
	{ address: '224.0.0.0', prefix: 4, family: IP_FAMILY.V4 },
	{ address: '240.0.0.0', prefix: 4, family: IP_FAMILY.V4 },
	{ address: '::', prefix: 128, family: IP_FAMILY.V6 },
	{ address: '::1', prefix: 128, family: IP_FAMILY.V6 },
	{ address: '64:ff9b::', prefix: 96, family: IP_FAMILY.V6 },
	{ address: '64:ff9b:1::', prefix: 48, family: IP_FAMILY.V6 },
	{ address: '100::', prefix: 64, family: IP_FAMILY.V6 },
	{ address: '2001:db8::', prefix: 32, family: IP_FAMILY.V6 },
	{ address: '2002::', prefix: 16, family: IP_FAMILY.V6 },
	{ address: 'fc00::', prefix: 7, family: IP_FAMILY.V6 },
	{ address: 'fe80::', prefix: 10, family: IP_FAMILY.V6 },
	{ address: 'ff00::', prefix: 8, family: IP_FAMILY.V6 },
];

export const LOCAL_HOSTNAME = 'localhost';

export const NON_PUBLIC_HOSTNAME_SUFFIXES = [
	'.localhost',
	'.local',
	'.internal',
	'.home.arpa',
] as const;

export const IPV6_HOST_BRACKETS = /^\[|\]$/g;

export const HOST_URL_PREFIX = 'http://';
