/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes } from 'node:crypto';
import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import type { CursorPage } from '../../../../common/dto/cursor-page.dto';
import { isUniqueViolation } from '../../../../common/utils/error/database-error.util';
import { findCursorPage } from '../../../../common/utils/pagination/cursor-page.util';
import { addMilliseconds } from '../../../../common/utils/time.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { EDGE_IDENTITY, EDGE_STATUS } from '../../constants/edge.constants';
import type {
	CreateEdgeDto,
	CreateEdgeResponseDto,
	EdgeDto,
	EdgeEnrollmentSecretDto,
	UpdateEdgeStatusDto,
} from '../../dto/edge.dto';
import { Edge } from '../../entities/edge.entity';
import { EdgeSession } from '../../entities/edge-session.entity';
import { hashEdgeSecret } from '../../utils/edge/edge-identity.util';
import { lockEdges } from '../../utils/network-lock.util';

interface DevelopmentEdgeEnrollment extends CreateEdgeDto {
	id: string;
	enrollmentSecret: string;
}

@Injectable()
export class EdgeService {
	constructor(private readonly entityManager: EntityManager) {}

	async create(input: CreateEdgeDto): Promise<CreateEdgeResponseDto> {
		this.validatePortInventory(input.portInventory);
		const now = await databaseNow(this.entityManager);
		const enrollment = this.createEnrollmentSecret(now);
		const edge = this.entityManager.create(Edge, {
			id: v4(),
			...input,
			name: input.name.trim(),
			publicHost: this.normalizeHostname(input.publicHost),
			status: EDGE_STATUS.ENROLLING,
			identityPublicKey: null,
			identityKeyId: null,
			identityKeyRegisteredAt: null,
			enrollmentSecretHash: hashEdgeSecret(enrollment.secret),
			enrollmentSecretExpiresAt: enrollment.expiresAt,
			enrollmentCompletedAt: null,
			credentialGeneration: 1,
			routeTableVersion: '0',
			routeTableGeneratedAt: now,
			routeTablePublishedVersion: null,
			routeTablePublishedDigest: null,
			sessionGeneration: 0,
			usageEpoch: 0,
			sessionExpiresAt: null,
			lastHeartbeatAt: null,
			lastStartedAt: null,
			lastReportedVersion: null,
			lastReportedRouteTableVersion: null,
			observedCapacity: null,
			lastFailureAt: null,
			lastFailureReason: null,
			createdAt: now,
			updatedAt: now,
		});

		try {
			this.entityManager.persist(edge);
			await this.entityManager.flush();
			return {
				...this.toDto(edge),
				enrollmentSecret: enrollment.secret,
				enrollmentSecretExpiresAt: enrollment.expiresAt.toISOString(),
			};
		} catch (error: unknown) {
			if (isUniqueViolation(error)) {
				throw new ConflictException(
					'Edge name or identity is already registered'
				);
			}
			throw error;
		}
	}

	async ensureDevelopmentEnrollment(
		input: DevelopmentEdgeEnrollment
	): Promise<boolean> {
		const existing = await this.entityManager.findOne(Edge, { id: input.id });
		if (existing?.enrollmentCompletedAt) return false;

		const now = await databaseNow(this.entityManager);
		const enrollmentSecretHash = hashEdgeSecret(input.enrollmentSecret);
		const enrollmentSecretExpiresAt = addMilliseconds(
			now,
			EDGE_IDENTITY.enrollmentDurationMilliseconds
		);
		if (existing) {
			existing.enrollmentSecretHash = enrollmentSecretHash;
			existing.enrollmentSecretExpiresAt = enrollmentSecretExpiresAt;
			existing.updatedAt = now;
			await this.entityManager.flush();
			return true;
		}

		this.validatePortInventory(input.portInventory);
		const edge = this.entityManager.create(Edge, {
			id: input.id,
			name: input.name.trim(),
			publicHost: this.normalizeHostname(input.publicHost),
			tunnelAddress: input.tunnelAddress,
			publicAddresses: input.publicAddresses,
			portInventory: input.portInventory,
			capacityProfile: input.capacityProfile,
			supportedProtocols: input.supportedProtocols,
			status: EDGE_STATUS.ENROLLING,
			identityPublicKey: null,
			identityKeyId: null,
			identityKeyRegisteredAt: null,
			enrollmentSecretHash,
			enrollmentSecretExpiresAt,
			enrollmentCompletedAt: null,
			credentialGeneration: 1,
			routeTableVersion: '0',
			routeTableGeneratedAt: now,
			routeTablePublishedVersion: null,
			routeTablePublishedDigest: null,
			sessionGeneration: 0,
			usageEpoch: 0,
			sessionExpiresAt: null,
			lastHeartbeatAt: null,
			lastStartedAt: null,
			lastReportedVersion: null,
			lastReportedRouteTableVersion: null,
			observedCapacity: null,
			lastFailureAt: null,
			lastFailureReason: null,
			createdAt: now,
			updatedAt: now,
		});
		this.entityManager.persist(edge);
		await this.entityManager.flush();
		return true;
	}

	async findAll(limit: number, cursor?: string): Promise<CursorPage<EdgeDto>> {
		const page = await findCursorPage(this.entityManager, Edge, {
			where: {},
			orderBy: { createdAt: 'DESC', id: 'DESC' },
			limit,
			cursor,
		});
		return { ...page, items: page.items.map((edge) => this.toDto(edge)) };
	}

	async findOneOrFail(id: string): Promise<Edge> {
		const edge = await this.entityManager.findOne(Edge, { id });
		if (!edge) throw new NotFoundException('Edge not found');
		return edge;
	}

	async findOneDtoOrFail(id: string): Promise<EdgeDto> {
		return this.toDto(await this.findOneOrFail(id));
	}

	async updateStatus(id: string, input: UpdateEdgeStatusDto): Promise<EdgeDto> {
		return this.entityManager.transactional(
			async (manager) => {
				if (input.status === EDGE_STATUS.ENROLLING) {
					throw new ConflictException(
						'Only enrollment-secret rotation can place an Edge in enrolling state'
					);
				}
				const [edge] = await lockEdges(manager, [id]);
				if (!edge) throw new NotFoundException('Edge not found');
				if (
					input.status === EDGE_STATUS.ACTIVE &&
					(!edge.identityPublicKey || !edge.enrollmentCompletedAt)
				) {
					throw new ConflictException('An unenrolled Edge cannot be activated');
				}
				edge.status = input.status;
				return this.toDto(edge);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async reissueEnrollmentSecret(id: string): Promise<EdgeEnrollmentSecretDto> {
		return this.entityManager.transactional(
			async (manager) => {
				const [edge] = await lockEdges(manager, [id]);
				if (!edge) throw new NotFoundException('Edge not found');
				const now = await databaseNow(manager);
				const enrollment = this.createEnrollmentSecret(now);
				edge.status = EDGE_STATUS.ENROLLING;
				edge.credentialGeneration += 1;
				edge.sessionGeneration += 1;
				edge.sessionExpiresAt = null;
				edge.enrollmentSecretHash = hashEdgeSecret(enrollment.secret);
				edge.enrollmentSecretExpiresAt = enrollment.expiresAt;
				edge.enrollmentCompletedAt = null;
				await manager.nativeUpdate(
					EdgeSession,
					{ edgeId: edge.id, revokedAt: null },
					{ revokedAt: now, updatedAt: now }
				);
				return {
					edgeId: edge.id,
					enrollmentSecret: enrollment.secret,
					enrollmentSecretExpiresAt: enrollment.expiresAt.toISOString(),
				};
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async remove(id: string): Promise<void> {
		const affected = await this.entityManager.nativeDelete(Edge, { id });
		if (affected === 0) throw new NotFoundException('Edge not found');
	}

	toDto(edge: Edge): EdgeDto {
		return {
			id: edge.id,
			name: edge.name,
			status: edge.status,
			publicHost: edge.publicHost,
			tunnelAddress: edge.tunnelAddress,
			publicAddresses: edge.publicAddresses,
			portInventory: edge.portInventory,
			capacityProfile: edge.capacityProfile,
			supportedProtocols: edge.supportedProtocols,
			credentialGeneration: edge.credentialGeneration,
			sessionGeneration: edge.sessionGeneration,
			sessionExpiresAt: edge.sessionExpiresAt?.toISOString(),
			lastHeartbeatAt: edge.lastHeartbeatAt?.toISOString(),
			createdAt: edge.createdAt.toISOString(),
			updatedAt: edge.updatedAt.toISOString(),
		};
	}

	private createEnrollmentSecret(now: Date): {
		secret: string;
		expiresAt: Date;
	} {
		return {
			secret: randomBytes(EDGE_IDENTITY.enrollmentSecretBytes).toString(
				'base64url'
			),
			expiresAt: addMilliseconds(
				now,
				EDGE_IDENTITY.enrollmentDurationMilliseconds
			),
		};
	}

	private normalizeHostname(hostname: string): string {
		return hostname.trim().toLowerCase().replace(/\.$/, '');
	}

	private validatePortInventory(
		inventory: CreateEdgeDto['portInventory']
	): void {
		for (const ranges of [inventory.tcp, inventory.udp]) {
			const ordered = [...ranges].sort((left, right) => left.from - right.from);
			for (let index = 0; index < ordered.length; index += 1) {
				const current = ordered[index];
				const previous = ordered[index - 1];
				if (current.from > current.to) {
					throw new BadRequestException(
						'Edge port range start exceeds its end'
					);
				}
				if (previous && current.from <= previous.to) {
					throw new BadRequestException(
						'Edge port inventory contains overlaps'
					);
				}
			}
		}
	}
}
