/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { AdministratorBootstrapService } from '../../../auth/services/administrator-bootstrap.service';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { DockerRegistryService } from '../../../docker-registry/registry/services/docker-registry.service';
import { NETWORK_PROTOCOL } from '../../../networking/routing/constants/networking.constants';
import { EdgeService } from '../../../networking/routing/services/edge/edge.service';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import {
	DEVELOPMENT_ADMINISTRATOR,
	DEVELOPMENT_EDGE,
	DEVELOPMENT_REGISTRY,
	DEVELOPMENT_SEED_SETTINGS,
} from '../constants/development-seed.constants';

const DEVELOPMENT_EDGE_PROTOCOLS = [
	NETWORK_PROTOCOL.HTTP,
	NETWORK_PROTOCOL.TCP,
	NETWORK_PROTOCOL.UDP,
];
const DEVELOPMENT_EDGE_CAPACITY = {
	version: 1,
	tunnels: 1_000,
	httpRequests: 10_000,
	httpConnections: 1_000,
	httpStreams: 1_000,
	tcpConnections: 1_000,
	udpFlows: 1_000,
	bytesPerSecondIn: 1_000_000_000,
	bytesPerSecondOut: 1_000_000_000,
	packetsPerSecond: 1_000_000,
} as const;

@Injectable()
export class DevelopmentSeedService {
	private readonly logger = new Logger(DevelopmentSeedService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly edges: EdgeService,
		private readonly registries: DockerRegistryService,
		private readonly config: TypedConfigService,
		private readonly administrators: AdministratorBootstrapService
	) {}

	async apply(): Promise<void> {
		if (await this.administrators.createFirst(DEVELOPMENT_ADMINISTRATOR)) {
			this.logger.log(
				`Development administrator ${DEVELOPMENT_ADMINISTRATOR.email} created`
			);
		}
		await this.ensureRegistry();
		if (await this.settings.applyFirstRun(DEVELOPMENT_SEED_SETTINGS)) {
			this.logger.log('Development settings applied');
		}
		const { edgeEnrollmentSecret } = this.config.get('development');
		if (!edgeEnrollmentSecret) {
			throw new Error(
				'apps/api/.env must set SNAPFLOW_DEVELOPMENT_EDGE_ENROLLMENT_SECRET'
			);
		}
		await this.enrollEdge(edgeEnrollmentSecret);
	}

	// Registers the dev registry as a platform source so snapshots can pull from it.
	private async ensureRegistry(): Promise<void> {
		const registries = await this.registries.findPlatformRegistries();
		if (registries.some(({ url }) => url === DEVELOPMENT_REGISTRY.url)) return;
		await this.entityManager.transactional((manager) =>
			this.registries.createPlatformRegistry(DEVELOPMENT_REGISTRY, manager)
		);
		this.logger.log(`Development registry ${DEVELOPMENT_REGISTRY.url} added`);
	}

	private async enrollEdge(enrollmentSecret: string): Promise<void> {
		const awaitingEnrollment = await this.edges.ensureDevelopmentEnrollment({
			id: DEVELOPMENT_EDGE.id,
			enrollmentSecret,
			name: DEVELOPMENT_EDGE.name,
			publicHost: DEVELOPMENT_EDGE.publicHost,
			tunnelAddress: DEVELOPMENT_EDGE.tunnelAddress,
			publicAddresses: [
				{
					host: DEVELOPMENT_EDGE.publicHost,
					address: DEVELOPMENT_EDGE.loopbackAddress,
					protocols: DEVELOPMENT_EDGE_PROTOCOLS,
				},
			],
			portInventory: {
				tcp: [DEVELOPMENT_EDGE.portRange],
				udp: [DEVELOPMENT_EDGE.portRange],
			},
			capacityProfile: DEVELOPMENT_EDGE_CAPACITY,
			supportedProtocols: DEVELOPMENT_EDGE_PROTOCOLS,
		});
		this.logger.log(
			awaitingEnrollment
				? `Development Edge ${DEVELOPMENT_EDGE.id} is ready for enrollment`
				: `Development Edge ${DEVELOPMENT_EDGE.id} is already enrolled`
		);
	}
}
