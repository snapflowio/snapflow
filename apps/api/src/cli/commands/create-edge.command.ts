/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';
import { NestFactory } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { type ValidationError, validate } from 'class-validator';
import { Command, CommandRunner, Option } from 'nest-commander';
import { EDGE_DEFAULTS } from '../../networking/constants/edge.constants';
import {
	NETWORK_PROTOCOL,
	type NetworkProtocol,
} from '../../networking/constants/networking.constants';
import { CreateEdgeDto } from '../../networking/dto/edge.dto';
import { EdgeService } from '../../networking/services/edge/edge.service';
import { writeLine } from '../cli-output.util';

const CLI_LOG_LEVELS = ['warn', 'error'] as const;
const LIST_SEPARATOR = ',';
const RANGE_SEPARATOR = '-';

type PortRange = Readonly<{ from: number; to: number }>;

type CreateEdgeOptions = Readonly<{
	name?: string;
	publicHost?: string;
	publicAddress?: string;
	tunnelPort?: number;
	protocols?: NetworkProtocol[];
	tcpPorts?: PortRange[];
	udpPorts?: PortRange[];
}>;

@Command({
	name: 'create-edge',
	description:
		'Create an Edge and print its ID and one-time enrollment secret as JSON',
})
export class CreateEdgeCommand extends CommandRunner {
	@Option({ flags: '--name <name>', description: 'Edge name' })
	parseName(value: string): string {
		return value.trim();
	}

	@Option({
		flags: '--public-host <host>',
		description: 'Hostname the Edge serves sandboxes and tunnels on',
	})
	parsePublicHost(value: string): string {
		return value.trim().toLowerCase();
	}

	@Option({
		flags: '--public-address <address>',
		description: 'Public IP address the public host resolves to',
	})
	parsePublicAddress(value: string): string {
		return value.trim();
	}

	@Option({
		flags: '--tunnel-port <port>',
		description: `Machine tunnel port (default ${EDGE_DEFAULTS.tunnelPort})`,
	})
	parseTunnelPort(value: string): number {
		return parsePort(value);
	}

	@Option({
		flags: '--protocols <list>',
		description: `Comma-separated protocols from ${Object.values(NETWORK_PROTOCOL).join(', ')} (default ${NETWORK_PROTOCOL.HTTP})`,
	})
	parseProtocols(value: string): NetworkProtocol[] {
		const protocols = splitList(value);
		const known = new Set<string>(Object.values(NETWORK_PROTOCOL));
		const unknown = protocols.filter((protocol) => !known.has(protocol));
		if (unknown.length > 0) {
			throw new Error(`Unknown protocols: ${unknown.join(', ')}`);
		}
		return protocols as NetworkProtocol[];
	}

	@Option({
		flags: '--tcp-ports <ranges>',
		description:
			'Comma-separated TCP port ranges for TCP exposures, such as 20000-20099',
	})
	parseTcpPorts(value: string): PortRange[] {
		return parsePortRanges(value);
	}

	@Option({
		flags: '--udp-ports <ranges>',
		description:
			'Comma-separated UDP port ranges for UDP exposures, such as 20000-20099',
	})
	parseUdpPorts(value: string): PortRange[] {
		return parsePortRanges(value);
	}

	public async run(): Promise<void> {
		const input = await this.input(this.command.opts<CreateEdgeOptions>());
		const { CliAppModule } = await import('../../app.module');
		const app = await NestFactory.createApplicationContext(CliAppModule, {
			logger: [...CLI_LOG_LEVELS],
		});
		try {
			const edge = await RequestContext.create(app.get(MikroORM).em, () =>
				app.get(EdgeService).create(input)
			);
			writeLine(
				JSON.stringify({
					id: edge.id,
					name: edge.name,
					publicHost: edge.publicHost,
					enrollmentSecret: edge.enrollmentSecret,
					enrollmentSecretExpiresAt: edge.enrollmentSecretExpiresAt,
				})
			);
		} finally {
			await app.close();
		}
	}

	private async input(options: CreateEdgeOptions): Promise<CreateEdgeDto> {
		const { name, publicHost, publicAddress } = options;
		if (!name || !publicHost || !publicAddress) {
			throw new Error(
				'--name, --public-host and --public-address are required'
			);
		}
		const protocols = options.protocols ?? [NETWORK_PROTOCOL.HTTP];
		const input = plainToInstance(CreateEdgeDto, {
			name,
			publicHost,
			tunnelAddress: {
				host: publicHost,
				port: options.tunnelPort ?? EDGE_DEFAULTS.tunnelPort,
			},
			publicAddresses: [
				{ host: publicHost, address: publicAddress, protocols },
			],
			portInventory: {
				tcp: options.tcpPorts ?? [],
				udp: options.udpPorts ?? [],
			},
			supportedProtocols: protocols,
		});
		const errors = await validate(input, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		if (errors.length > 0) {
			throw new Error(validationMessages(errors).join('; '));
		}
		return input;
	}
}

function splitList(value: string): string[] {
	return value
		.split(LIST_SEPARATOR)
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length > 0);
}

function parsePort(value: string): number {
	const port = Number(value);
	if (!Number.isInteger(port)) {
		throw new Error(`${value} is not a port number`);
	}
	return port;
}

function parsePortRanges(value: string): PortRange[] {
	return splitList(value).map((range) => {
		const [from, to = from] = range.split(RANGE_SEPARATOR);
		return { from: parsePort(from), to: parsePort(to) };
	});
}

function validationMessages(
	errors: readonly ValidationError[],
	path = ''
): string[] {
	return errors.flatMap((error) => {
		const property = path ? `${path}.${error.property}` : error.property;
		return [
			...Object.values(error.constraints ?? {}).map(
				(message) => `${property}: ${message}`
			),
			...validationMessages(error.children ?? [], property),
		];
	});
}
