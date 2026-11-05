/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { IsolationLevel, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	Injectable,
	InternalServerErrorException,
	ServiceUnavailableException,
	UnauthorizedException,
} from '@nestjs/common';
import { CloudflareDomainProvider } from '../../../cloudflare/services/cloudflare-domain-provider.service';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { observeOperation } from '../../../infra/logging/utils/operation-observability.util';
import { SettingsService } from '../../../settings/services/settings.service';
import { EDGE_CONTROL_LIMITS } from '../../constants/edge.constants';
import {
	ACTIVE_BACKEND_STATES,
	CUSTOM_DOMAIN_STATE,
} from '../../constants/exposure.constants';
import { LIVE_BINDING_STATES } from '../../constants/machine-tunnel.constants';
import type { EdgeRouteSnapshotDto } from '../../dto/edge-route-snapshot.dto';
import { CustomDomain } from '../../entities/custom-domain.entity';
import { Edge } from '../../entities/edge.entity';
import type { EdgeSession } from '../../entities/edge-session.entity';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';
import {
	type EdgeRouteSource,
	edgeMachineBindingDto,
	edgeRouteLists,
} from '../../utils/edge/edge-route-dto.util';
import {
	type EdgeRouteSnapshotContent,
	edgeRouteSnapshotDigest,
} from '../../utils/edge/edge-route-snapshot-digest.util';
import { isPublicExposure } from '../../utils/exposure/public-ingress-policy.util';
import { ControlSnapshotRefreshService } from '../control-snapshot-refresh.service';

type RouteTablePublication = Pick<
	Edge,
	'routeTablePublishedVersion' | 'routeTablePublishedDigest'
>;

interface BuiltRouteSnapshot {
	snapshot: EdgeRouteSnapshotDto;
	publication: RouteTablePublication;
}

@Injectable()
export class EdgeRouteSnapshotService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly configService: TypedConfigService,
		private readonly settings: SettingsService,
		private readonly cloudflare: CloudflareDomainProvider,
		private readonly snapshotRefresh: ControlSnapshotRefreshService
	) {}

	async build(session: EdgeSession): Promise<EdgeRouteSnapshotDto> {
		return observeOperation('edge.route.publish', {}, async () => {
			const trustedHttpProxyCidrs = await this.trustedHttpProxyCidrs();
			await this.snapshotRefresh.refreshEdgeIfStale(session.edgeId);
			for (
				let attempt = 0;
				attempt < EDGE_CONTROL_LIMITS.routeSnapshotPublicationAttempts;
				attempt += 1
			) {
				const built = await this.read(session, trustedHttpProxyCidrs);
				if (await this.publish(session.edgeId, built)) return built.snapshot;
			}
			throw new ServiceUnavailableException(
				'Edge route snapshot kept changing while it was published'
			);
		});
	}

	private async publish(
		edgeId: string,
		{ snapshot, publication }: BuiltRouteSnapshot
	): Promise<boolean> {
		if (publication.routeTablePublishedVersion !== snapshot.version) {
			const claimed = await this.entityManager.nativeUpdate(
				Edge,
				{
					id: edgeId,
					routeTableVersion: snapshot.version,
					$or: [
						{ routeTablePublishedVersion: null },
						{ routeTablePublishedVersion: { $ne: snapshot.version } },
						{ routeTablePublishedDigest: snapshot.digest },
					],
				},
				{
					routeTablePublishedVersion: snapshot.version,
					routeTablePublishedDigest: snapshot.digest,
				}
			);
			return claimed > 0;
		}
		if (publication.routeTablePublishedDigest === snapshot.digest) return true;
		await this.snapshotRefresh.reissueEdgeVersion(edgeId, snapshot.version);
		return false;
	}

	private async trustedHttpProxyCidrs(): Promise<string[]> {
		const { edgeTrustedHttpProxyCidrs } = await this.settings.get();
		const cidrs = await this.cloudflare.trustedProxyCidrs(
			edgeTrustedHttpProxyCidrs
		);
		if (cidrs.length > EDGE_CONTROL_LIMITS.maximumTrustedProxyCidrs) {
			throw new InternalServerErrorException(
				'Configured trusted proxy network count exceeds the Edge snapshot limit'
			);
		}
		return [...cidrs].sort();
	}

	private read(
		session: EdgeSession,
		trustedHttpProxyCidrs: string[]
	): Promise<BuiltRouteSnapshot> {
		return this.entityManager.transactional(
			async (manager) => {
				const observedAt = await databaseNow(manager);
				const edge = await manager.findOne(Edge, { id: session.edgeId });
				if (
					!edge ||
					session.revokedAt ||
					session.expiresAt <= observedAt ||
					edge.sessionGeneration !== session.generation
				) {
					throw new UnauthorizedException(
						'Edge session no longer receives route snapshots'
					);
				}
				const generatedAt = edge.routeTableGeneratedAt;
				const bindings = await manager.find(
					MachineEdgeBinding,
					{
						edgeId: edge.id,
						observedState: { $in: [...LIVE_BINDING_STATES] },
						leaseExpiresAt: { $gt: observedAt },
					},
					{ orderBy: { machineId: 'ASC', revision: 'ASC' } }
				);
				const routes = await this.routeSources(manager, edge.id, observedAt);
				this.assertSnapshotBounds(bindings.length, routes.length);
				const backends = routes.map(({ backend }) => backend);
				const snapshot: EdgeRouteSnapshotContent = {
					edgeId: edge.id,
					edgeSessionGeneration: session.generation,
					version: edge.routeTableVersion,
					generatedAt: generatedAt.toISOString(),
					expiresAt: this.snapshotExpiry(
						generatedAt,
						session,
						bindings,
						backends
					).toISOString(),
					trustedHttpProxyCidrs,
					machineBindings: bindings.map(edgeMachineBindingDto),
					...edgeRouteLists(
						routes,
						new Set(bindings.map((binding) => binding.id)),
						await this.customHostnames(manager, backends),
						this.configService.get('deployment').hosted
					),
				};
				return {
					snapshot: { ...snapshot, digest: edgeRouteSnapshotDigest(snapshot) },
					publication: {
						routeTablePublishedVersion: edge.routeTablePublishedVersion,
						routeTablePublishedDigest: edge.routeTablePublishedDigest,
					},
				};
			},
			{
				isolationLevel: IsolationLevel.REPEATABLE_READ,
				propagation: TransactionPropagation.REQUIRED,
				clear: true,
			}
		);
	}

	private async routeSources(
		manager: EntityManager,
		edgeId: string,
		observedAt: Date
	): Promise<EdgeRouteSource[]> {
		const backends = await manager.find(
			ExposureBackend,
			{
				edgeId,
				state: { $in: [...ACTIVE_BACKEND_STATES] },
				leaseExpiresAt: { $gt: observedAt },
			},
			{ orderBy: { createdAt: 'ASC', id: 'ASC' } }
		);
		const exposures = await manager.find(Exposure, {
			id: { $in: backends.map((backend) => backend.exposureId) },
		});
		const exposureById = new Map(
			exposures.map((exposure) => [exposure.id, exposure])
		);
		const sources = backends.map((backend) => {
			const exposure = exposureById.get(backend.exposureId);
			if (!exposure) {
				throw new InternalServerErrorException(
					`Exposure backend ${backend.id} has no exposure`
				);
			}
			return { backend, exposure };
		});
		if ((await this.settings.get()).publicIngressEnabled) return sources;
		return sources.filter(({ exposure }) => !isPublicExposure(exposure));
	}

	private async customHostnames(
		manager: EntityManager,
		backends: readonly ExposureBackend[]
	): Promise<Map<string, string[]>> {
		const hostnamesByExposure = new Map<string, string[]>();
		if (backends.length === 0) return hostnamesByExposure;
		const domains = await manager.find(
			CustomDomain,
			{
				exposureId: {
					$in: [...new Set(backends.map((backend) => backend.exposureId))],
				},
				state: CUSTOM_DOMAIN_STATE.ACTIVE,
			},
			{ orderBy: { hostname: 'ASC' } }
		);
		for (const domain of domains) {
			const hostnames = hostnamesByExposure.get(domain.exposureId) ?? [];
			hostnames.push(domain.hostname);
			hostnamesByExposure.set(domain.exposureId, hostnames);
		}
		return hostnamesByExposure;
	}

	private snapshotExpiry(
		generatedAt: Date,
		session: EdgeSession,
		bindings: readonly MachineEdgeBinding[],
		backends: readonly ExposureBackend[]
	): Date {
		const maximumExpiry =
			generatedAt.getTime() +
			EDGE_CONTROL_LIMITS.routeSnapshotLifetimeMilliseconds;
		const resourceExpiries = [
			session.expiresAt.getTime(),
			...bindings.map((binding) => binding.leaseExpiresAt.getTime()),
			...backends.map((backend) => backend.leaseExpiresAt.getTime()),
		];
		return new Date(Math.min(maximumExpiry, ...resourceExpiries));
	}

	private assertSnapshotBounds(bindingCount: number, routeCount: number): void {
		if (bindingCount > EDGE_CONTROL_LIMITS.maximumBindingsPerSnapshot) {
			throw new InternalServerErrorException(
				'Edge machine-binding count exceeds the route snapshot limit'
			);
		}
		if (routeCount > EDGE_CONTROL_LIMITS.maximumRoutesPerSnapshot) {
			throw new InternalServerErrorException(
				'Edge route count exceeds the route snapshot limit'
			);
		}
	}
}
