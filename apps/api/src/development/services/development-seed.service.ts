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
import { AdministratorBootstrapService } from '../../auth/services/administrator-bootstrap.service';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { DockerRegistryService } from '../../docker-registry/services/docker-registry.service';
import { LEGAL_DOCUMENT_VERSION } from '../../legal/constants/legal-documents.constants';
import { NETWORK_PROTOCOL } from '../../networking/constants/networking.constants';
import { EdgeService } from '../../networking/services/edge/edge.service';
import { SettingsService } from '../../settings/services/settings.service';
import { UserService } from '../../user/services/user.service';
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

@Injectable()
export class DevelopmentSeedService {
	private readonly logger = new Logger(DevelopmentSeedService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly edges: EdgeService,
		private readonly registries: DockerRegistryService,
		private readonly config: TypedConfigService,
		private readonly administrators: AdministratorBootstrapService,
		private readonly users: UserService
	) {}

	async apply(): Promise<void> {
		if (await this.administrators.createFirst(DEVELOPMENT_ADMINISTRATOR)) {
			this.logger.log(
				`Development administrator ${DEVELOPMENT_ADMINISTRATOR.email} created`
			);
		}
		await this.acceptAdministratorTerms();
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

	private async acceptAdministratorTerms(): Promise<void> {
		const administrator = await this.users.findOneByEmail(
			DEVELOPMENT_ADMINISTRATOR.email
		);
		if (
			!administrator ||
			administrator.acceptedTermsVersion === LEGAL_DOCUMENT_VERSION.TERMS
		) {
			return;
		}
		await this.users.acceptTerms(
			administrator.id,
			LEGAL_DOCUMENT_VERSION.TERMS
		);
		this.logger.log(
			`Development administrator accepted Terms version ${LEGAL_DOCUMENT_VERSION.TERMS}`
		);
	}

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
			supportedProtocols: DEVELOPMENT_EDGE_PROTOCOLS,
		});
		this.logger.log(
			awaitingEnrollment
				? `Development Edge ${DEVELOPMENT_EDGE.id} is ready for enrollment`
				: `Development Edge ${DEVELOPMENT_EDGE.id} is already enrolled`
		);
	}
}
