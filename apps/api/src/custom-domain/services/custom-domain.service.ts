/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, QueryOrder, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { CloudflareZoneService } from '../../cloudflare/services/cloudflare-zone.service';
import { ID_OR_NAME_MATCH_LIMIT } from '../../common/constants/query.constants';
import { isUniqueViolation } from '../../common/utils/error/database-error.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import {
	CUSTOM_DOMAIN_STATE,
	EXPOSURE_DESIRED_STATE,
} from '../../networking/constants/exposure.constants';
import { NETWORK_PROTOCOL } from '../../networking/constants/networking.constants';
import { CustomDomain } from '../../networking/entities/custom-domain.entity';
import { Exposure } from '../../networking/entities/exposure.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import type {
	CreateCustomDomainDto,
	CustomDomainDto,
	CustomDomainPageDto,
} from '../dto/custom-domain.dto';
import { normalizeCustomDomain } from '../utils/custom-domain.util';

@Injectable()
export class CustomDomainService {
	private readonly platformDomain: string | undefined;

	constructor(
		private readonly entityManager: EntityManager,
		private readonly zone: CloudflareZoneService,
		config: TypedConfigService
	) {
		this.platformDomain = config.get('networking.platformDomain');
	}

	async create(
		organizationId: string,
		sandboxId: string,
		exposureId: string,
		input: CreateCustomDomainDto,
		manager?: EntityManager
	): Promise<CustomDomainDto> {
		const cnameTarget = await this.requireConfiguration();
		const hostname = normalizeCustomDomain(
			input.hostname,
			[this.platformDomain, cnameTarget].filter((value): value is string =>
				Boolean(value)
			)
		);
		try {
			const persist = async (entityManager: EntityManager) => {
				const sandbox = await this.findSandbox(
					entityManager,
					sandboxId,
					organizationId
				);
				const exposure = await entityManager.findOne(Exposure, {
					id: exposureId,
					organizationId,
					sandboxId: sandbox.id,
					protocol: NETWORK_PROTOCOL.HTTP,
					desiredState: EXPOSURE_DESIRED_STATE.ACTIVE,
				});
				if (!exposure) throw new NotFoundException('HTTP exposure not found');
				const now = await databaseNow(entityManager);
				const domain = entityManager.create(CustomDomain, {
					id: v4(),
					organizationId,
					sandboxId: sandbox.id,
					exposureId: exposure.id,
					hostname,
					state: CUSTOM_DOMAIN_STATE.PENDING,
					desiredGeneration: 1,
					observedGeneration: 0,
					providerId: null,
					providerHostnameStatus: null,
					certificateStatus: null,
					originHostname: exposure.originHostname,
					verificationRecords: [],
					activatedAt: null,
					lastSynchronizedAt: null,
					deletionRequestedAt: null,
					lastError: null,
					createdAt: now,
					updatedAt: now,
				});
				entityManager.persist(domain);
				return domain;
			};
			const domain = await (manager
				? persist(manager)
				: this.entityManager.transactional(persist, {
						propagation: TransactionPropagation.REQUIRED,
					}));
			return this.toDto(domain, cnameTarget);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictException('Custom domain is already reserved');
			}
			throw error;
		}
	}

	async list(
		organizationId: string,
		sandboxId: string,
		exposureId: string,
		limit: number,
		cursor?: string
	): Promise<CustomDomainPageDto> {
		const cnameTarget = await this.requireConfiguration();
		const sandbox = await this.findSandbox(
			this.entityManager,
			sandboxId,
			organizationId
		);
		const page = await findCursorPage(this.entityManager, CustomDomain, {
			where: { organizationId, sandboxId: sandbox.id, exposureId },
			orderBy: { createdAt: QueryOrder.ASC, id: QueryOrder.ASC },
			limit,
			cursor,
		});
		return {
			...page,
			items: page.items.map((domain) => this.toDto(domain, cnameTarget)),
		};
	}

	async remove(
		organizationId: string,
		sandboxId: string,
		exposureId: string,
		domainId: string
	): Promise<void> {
		const sandbox = await this.findSandbox(
			this.entityManager,
			sandboxId,
			organizationId
		);
		await this.entityManager.transactional(
			async (manager) => {
				const domain = await manager.findOne(
					CustomDomain,
					{
						id: domainId,
						organizationId,
						sandboxId: sandbox.id,
						exposureId,
					},
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!domain) throw new NotFoundException('Custom domain not found');
				if (domain.state === CUSTOM_DOMAIN_STATE.DELETING) return;
				domain.state = CUSTOM_DOMAIN_STATE.DELETING;
				domain.desiredGeneration += 1;
				domain.deletionRequestedAt = await databaseNow(manager);
				domain.lastError = null;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async findSandbox(
		manager: EntityManager,
		sandboxIdOrName: string,
		organizationId: string
	): Promise<Sandbox> {
		const criteria = {
			organizationId,
			state: { $ne: SandboxState.DESTROYED },
		};
		const matches = await manager.find(
			Sandbox,
			{
				...criteria,
				$or: [{ id: sandboxIdOrName }, { name: sandboxIdOrName }],
			},
			{ limit: ID_OR_NAME_MATCH_LIMIT }
		);
		const sandbox =
			matches.find(({ id }) => id === sandboxIdOrName) ??
			matches.find(({ name }) => name === sandboxIdOrName) ??
			null;
		if (!sandbox) throw new NotFoundException('Sandbox not found');
		return sandbox;
	}

	private requireConfiguration(): Promise<string> {
		if (!this.zone.isConfigured()) {
			throw new ServiceUnavailableException(
				'Custom domains require Cloudflare for SaaS ingress configuration'
			);
		}
		return this.zone.customHostnameTarget();
	}

	private toDto(domain: CustomDomain, cnameTarget: string): CustomDomainDto {
		return {
			id: domain.id,
			exposureId: domain.exposureId,
			hostname: domain.hostname,
			cnameTarget,
			state: domain.state,
			desiredGeneration: domain.desiredGeneration,
			observedGeneration: domain.observedGeneration,
			providerHostnameStatus: domain.providerHostnameStatus,
			certificateStatus: domain.certificateStatus,
			verificationRecords: domain.verificationRecords,
			activatedAt: domain.activatedAt?.toISOString() ?? null,
			lastSynchronizedAt: domain.lastSynchronizedAt?.toISOString() ?? null,
			lastError: domain.lastError,
			createdAt: domain.createdAt.toISOString(),
			updatedAt: domain.updatedAt.toISOString(),
		};
	}
}
