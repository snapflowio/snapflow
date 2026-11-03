/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CoalescingRunner } from '../../../../common/utils/concurrency/coalescing-runner.util';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import {
	ACTIVE_BACKEND_STATES,
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_DESIRED_STATE,
} from '../../constants/exposure.constants';
import {
	NETWORK_PROTOCOL,
	NETWORKING_RECONCILIATION,
} from '../../constants/networking.constants';
import { NetworkingEvents } from '../../constants/networking-events.constants';
import { Edge } from '../../entities/edge.entity';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { requiresExposureCutover } from '../../utils/exposure/exposure-cutover.util';
import {
	findLiveBackends,
	lockExposureNetwork,
	lockExposures,
} from '../../utils/network-lock.util';
import { ExposureActivationService } from './exposure-activation.service';
import { ExposureManagedDnsService } from './exposure-managed-dns.service';
import { ExposureReconciliationQueueService } from './exposure-reconciliation-queue.service';

@Injectable()
export class ExposureDnsReconcilerService {
	private readonly logger = new Logger(ExposureDnsReconcilerService.name);
	private readonly readyActivations = new CoalescingRunner(() =>
		RequestContext.create(this.entityManager, () => this.activateReady())
	);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly managedDns: ExposureManagedDnsService,
		private readonly activation: ExposureActivationService,
		private readonly exposureQueue: ExposureReconciliationQueueService
	) {}

	async reconcileReady(): Promise<void> {
		await this.readyActivations.run();
		await RequestContext.create(this.entityManager, () =>
			this.reconcileDeleting()
		);
	}

	@OnEvent(NetworkingEvents.EXPOSURE_DNS_ACTIVATION_REQUESTED)
	handleActivationRequested(): void {
		this.readyActivations.run().catch((error: unknown) => {
			this.logger.warn(
				`Exposure DNS activation pass failed: ${errorMessage(error)}`
			);
		});
	}

	private async activateReady(): Promise<void> {
		const now = await databaseNow(this.entityManager);
		const ready = await this.entityManager.find(
			ExposureBackend,
			{
				protocol: NETWORK_PROTOCOL.HTTP,
				state: {
					$in: [EXPOSURE_BACKEND_STATE.PENDING, EXPOSURE_BACKEND_STATE.ACTIVE],
				},
				edgeAcknowledgedAt: { $ne: null },
				machineAcknowledgedAt: { $ne: null },
				dnsActivatedAt: null,
				leaseExpiresAt: { $gt: now },
			},
			{
				orderBy: { createdAt: 'ASC' },
				limit: NETWORKING_RECONCILIATION.claimBatchSize,
			}
		);
		for (const backend of ready) {
			try {
				await this.reconcileBackendById(backend.id);
			} catch (error) {
				this.logger.warn(
					`Exposure backend ${backend.id} DNS reconciliation failed: ${errorMessage(error)}`
				);
			}
		}
	}

	private async reconcileDeleting(): Promise<void> {
		const liveStatePlaceholders = ACTIVE_BACKEND_STATES.map(() => '?').join(
			', '
		);
		const rows = await this.entityManager.execute<{ id: string }[]>(
			`SELECT exposure.id
				 FROM "sandbox_exposure" exposure
				 WHERE exposure.protocol = ?
				   AND exposure."desiredState" = ?
				   AND exposure."managedDnsDeletedAt" IS NULL
				   AND NOT EXISTS (
					SELECT 1 FROM "sandbox_exposure_backend" backend
					WHERE backend."exposureId" = exposure.id
					  AND backend.state IN (${liveStatePlaceholders})
				   )
				 ORDER BY exposure."deletionRequestedAt" ASC
				 LIMIT ?`,
			[
				NETWORK_PROTOCOL.HTTP,
				EXPOSURE_DESIRED_STATE.DELETING,
				...ACTIVE_BACKEND_STATES,
				NETWORKING_RECONCILIATION.claimBatchSize,
			]
		);
		const exposures = await this.entityManager.find(Exposure, {
			id: { $in: rows.map(({ id }) => id) },
		});
		for (const exposure of exposures) {
			try {
				await this.removeManagedDns(exposure);
			} catch (error) {
				this.logger.warn(
					`Exposure ${exposure.id} DNS deletion failed: ${errorMessage(error)}`
				);
			}
		}
	}

	private async removeManagedDns(exposure: Exposure): Promise<void> {
		await this.managedDns.remove(exposure);
		await this.entityManager.transactional(
			async (manager) => {
				const [current] = await lockExposures(manager, [exposure.id]);
				if (
					!current ||
					current.generation !== exposure.generation ||
					current.desiredState !== EXPOSURE_DESIRED_STATE.DELETING ||
					current.managedDnsDeletedAt
				)
					return;
				const liveBackend = await manager.findOne(
					ExposureBackend,
					{
						exposureId: current.id,
						state: { $in: [...ACTIVE_BACKEND_STATES] },
					},
					{ fields: ['id'], disableIdentityMap: true }
				);
				if (liveBackend) return;
				current.managedDnsDeletedAt = await databaseNow(manager);
				await this.exposureQueue.enqueue(
					manager,
					current.id,
					current.generation
				);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async reconcileBackendById(backendId: string): Promise<void> {
		const candidate = await this.entityManager.findOne(
			ExposureBackend,
			{ id: backendId },
			{ fields: ['exposureId'], disableIdentityMap: true }
		);
		if (!candidate) return;

		await this.entityManager.transactional(
			async (manager) => {
				const [exposure] = await lockExposures(manager, [candidate.exposureId]);
				if (!exposure) return;
				const observedAt = await databaseNow(manager);
				const edge = await this.dnsTargetEdge(
					manager,
					exposure,
					backendId,
					observedAt
				);
				if (!edge) return;

				await this.managedDns.pointAt(exposure, edge);

				const network = await lockExposureNetwork(manager, [exposure.id]);
				const current = network.backends.find(({ id }) => id === backendId);
				if (!current || !this.awaitsDns(exposure, current, observedAt)) return;
				current.dnsActivatedAt = observedAt;
				if (current.state === EXPOSURE_BACKEND_STATE.PENDING) {
					await manager.flush();
					await this.activation.activateReadyBackend(manager, current.id);
				}
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async dnsTargetEdge(
		manager: EntityManager,
		exposure: Exposure,
		backendId: string,
		observedAt: Date
	): Promise<Edge | null> {
		const liveBackends = await findLiveBackends(manager, [exposure.id]);
		const planned = liveBackends.find(({ id }) => id === backendId);
		if (!planned || !this.awaitsDns(exposure, planned, observedAt)) return null;
		const edge = await manager.findOne(Edge, { id: planned.edgeId });
		if (!edge || planned.dnsTargetHost !== edge.publicHost) return null;
		const awaitsCutover =
			requiresExposureCutover(
				planned,
				liveBackends.filter(
					(backend) => backend.state !== EXPOSURE_BACKEND_STATE.DRAINING
				)
			) && !planned.cutoverStartedAt;
		return awaitsCutover ? null : edge;
	}

	private awaitsDns(
		exposure: Exposure,
		backend: ExposureBackend,
		observedAt: Date
	): boolean {
		return (
			(backend.state === EXPOSURE_BACKEND_STATE.PENDING ||
				backend.state === EXPOSURE_BACKEND_STATE.ACTIVE) &&
			backend.edgeAcknowledgedAt !== null &&
			backend.machineAcknowledgedAt !== null &&
			exposure.desiredState === EXPOSURE_DESIRED_STATE.ACTIVE &&
			backend.exposureGeneration === exposure.generation &&
			backend.leaseExpiresAt > observedAt
		);
	}
}
