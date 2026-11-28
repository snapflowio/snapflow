/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateEdgeDto,
	type NetworkPortRangeDto,
	NetworkProtocol,
} from '@snapflow/api-client';
import * as z from 'zod';

const MINIMUM_PORT = 1;
const MAXIMUM_PORT = 65_535;
const MAXIMUM_NAME_LENGTH = 64;
const DEFAULT_TUNNEL_PORT = '8443';
const LIST_SEPARATOR = ',';
const RANGE_SEPARATOR = '-';
const PORT_PATTERN = /^\d+$/;

export const EDGE_PROTOCOL_OPTIONS = Object.values(NetworkProtocol).map(
	(protocol) => ({ label: protocol.toUpperCase(), value: protocol })
);

function parsePort(value: string): number | null {
	if (!PORT_PATTERN.test(value)) return null;
	const port = Number(value);
	return port >= MINIMUM_PORT && port <= MAXIMUM_PORT ? port : null;
}

function parsePortRanges(value: string): NetworkPortRangeDto[] | null {
	const ranges: NetworkPortRangeDto[] = [];
	for (const item of value.split(LIST_SEPARATOR)) {
		const range = item.trim();
		if (range.length === 0) continue;
		const parts = range.split(RANGE_SEPARATOR).map((part) => part.trim());
		const from = parsePort(parts[0] ?? '');
		const to = parsePort(parts[1] ?? parts[0] ?? '');
		if (parts.length > 2 || from === null || to === null || from > to) {
			return null;
		}
		ranges.push({ from, to });
	}
	return ranges;
}

const portRangesSchema = z
	.string()
	.trim()
	.refine(
		(value) => parsePortRanges(value) !== null,
		'Enter port ranges such as 20000-20099, 21000'
	);

export const createEdgeSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Name is required')
		.max(MAXIMUM_NAME_LENGTH, `Use at most ${MAXIMUM_NAME_LENGTH} characters`),
	publicHost: z.string().trim().toLowerCase().min(1, 'Public host is required'),
	publicAddress: z
		.string()
		.trim()
		.pipe(
			z.union([z.ipv4(), z.ipv6()], {
				error: 'Enter the IP address the public host resolves to',
			})
		),
	tunnelPort: z
		.string()
		.trim()
		.refine(
			(value) => parsePort(value) !== null,
			`Enter a port from ${MINIMUM_PORT} to ${MAXIMUM_PORT}`
		),
	protocols: z
		.array(z.enum(NetworkProtocol))
		.min(1, 'Choose at least one protocol'),
	tcpPorts: portRangesSchema,
	udpPorts: portRangesSchema,
});

export type CreateEdgeValues = z.input<typeof createEdgeSchema>;

export const CREATE_EDGE_DEFAULT_VALUES: CreateEdgeValues = {
	name: '',
	publicHost: '',
	publicAddress: '',
	tunnelPort: DEFAULT_TUNNEL_PORT,
	protocols: [NetworkProtocol.Http],
	tcpPorts: '',
	udpPorts: '',
};

export function createEdgeBody(values: CreateEdgeValues): CreateEdgeDto {
	const parsed = createEdgeSchema.parse(values);
	return {
		name: parsed.name,
		publicHost: parsed.publicHost,
		tunnelAddress: {
			host: parsed.publicHost,
			port: Number(parsed.tunnelPort),
		},
		publicAddresses: [
			{
				host: parsed.publicHost,
				address: parsed.publicAddress,
				protocols: parsed.protocols,
			},
		],
		portInventory: {
			tcp: parsePortRanges(parsed.tcpPorts) ?? [],
			udp: parsePortRanges(parsed.udpPorts) ?? [],
		},
		supportedProtocols: parsed.protocols,
	};
}
