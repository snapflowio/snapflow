/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { type FilterQuery, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommittedEventPublisher } from '../../infra/database/services/committed-event-publisher.service';
import {
	lockRowIdsForNoKeyUpdate,
	lockRowsForNoKeyUpdate,
} from '../../infra/database/utils/row-lock.util';
import { observeOperation } from '../../infra/logging/utils/operation-observability.util';
import { MachineDesiredStateRevisionService } from '../../machine/services/desired-state/machine-desired-state-revision.service';
import { desiredStateMachineIds } from '../../machine/utils/desired-state/desired-state-change.util';
import {
	runtimeIntentUpdate,
	type SandboxRuntimeIntent,
} from '../../machine/utils/proto/sandbox-runtime-intent.util';
import type { PriceEndReason } from '../../marketplace/enums/price-end-reason.enum';
import type { ReservedMachine } from '../../placement/services/machine-reservation.service';
import {
	SandboxPlacementService,
	type SynchronizePlacementOptions,
} from '../../placement/services/sandbox-placement.service';
import { VolumeAttachmentService } from '../../volume/services/volume-attachment.service';
import {
	sandboxCreatedWebhook,
	sandboxStateWebhooks,
} from '../../webhook/utils/domain-webhook.util';
import { publishWebhook } from '../../webhook/utils/webhook-publish.util';
import { SandboxPersistenceEvents } from '../constants/sandbox-persistence-events.constants';
import { ATTACHMENT_RELEASING_STATES } from '../constants/sandbox-state-machine.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxFork } from '../entities/sandbox-fork.entity';
import { SandboxLastActivity } from '../entities/sandbox-last-activity.entity';
import type { PlacementLocality } from '../enums/placement-locality.enum';
import { SandboxPersistedEvent } from '../events/sandbox-persisted.event';
import { SandboxAbuseHoldException } from '../exceptions/sandbox-abuse-hold.exception';
import { SandboxConflictException } from '../exceptions/sandbox-conflict.exception';
import { SandboxNotFoundException } from '../exceptions/sandbox-not-found.exception';
import {
	persistedConcurrencyGuard,
	placementSynchronizationOptions,
	type SandboxSnapshot,
	sandboxUpdateEvents,
} from '../utils/sandbox-update.util';
import {
	assertAbuseHoldAllowsStart,
	startsRuntime,
} from '../utils/state/abuse-hold.util';
import { getSandboxInvariantChanges } from '../utils/state/sandbox-invariants.util';
import { assertSandboxDesiredStateAcceptsState } from '../utils/state/sandbox-state-validation.util';

export type RuntimeIntentSource =
	| SandboxRuntimeIntent
	| ((machineId: string) => Promise<SandboxRuntimeIntent>);

export type MachineReservation = (
	manager: EntityManager,
	coLockedMachineIds: readonly string[]
) => Promise<ReservedMachine>;

export interface ReservedInsert {
	reserveMachine: (manager: EntityManager) => Promise<ReservedMachine>;
	parentId?: string;
	persistRelated?: (manager: EntityManager) => Promise<void>;
	manager?: EntityManager;
	runtimeIntent?: (machineId: string) => Promise<SandboxRuntimeIntent>;
}

interface InsertOptions {
	parentId?: string;
	persistRelated?: (manager: EntityManager) => Promise<void>;
	locality?: PlacementLocality;
	runtimeIntent?: (machineId: string) => Promise<SandboxRuntimeIntent>;
}

@Injectable()
export class SandboxRepository {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly eventEmitter: EventEmitter2,
		private readonly sandboxPlacementService: SandboxPlacementService,
		private readonly desiredStateRevisions: MachineDesiredStateRevisionService,
		private readonly committedEvents: CommittedEventPublisher,
		private readonly volumeAttachments: VolumeAttachmentService
	) {}

	async insert(
		sandbox: Sandbox,
		parentId?: string,
		persistRelated?: (manager: EntityManager) => Promise<void>,
		manager?: EntityManager
	): Promise<Sandbox> {
		this.prepareForInsert(sandbox);
		const options = { parentId, persistRelated };
		if (manager) {
			await this.persistInsert(manager, sandbox, options);
		} else {
			await this.entityManager.transactional(
				(entityManager) => this.persistInsert(entityManager, sandbox, options),
				{ propagation: TransactionPropagation.REQUIRED }
			);
		}
		return sandbox;
	}

	async insertWithMachineReservation(
		sandbox: Sandbox,
		{
			reserveMachine,
			parentId,
			persistRelated,
			manager,
			runtimeIntent,
		}: ReservedInsert
	): Promise<Sandbox> {
		this.prepareForInsert(sandbox);
		const persist = async (entityManager: EntityManager) => {
			const { machine, locality } = await reserveMachine(entityManager);
			sandbox.machineId = machine.id;
			sandbox.locateOn(machine);
			sandbox.enforceInvariants();
			await this.persistInsert(entityManager, sandbox, {
				parentId,
				persistRelated,
				locality,
				runtimeIntent,
			});
		};
		if (manager) await persist(manager);
		else {
			await this.entityManager.transactional(persist, {
				propagation: TransactionPropagation.REQUIRED,
			});
		}
		return sandbox;
	}

	private prepareForInsert(sandbox: Sandbox): void {
		const now = new Date();
		if (!sandbox.createdAt) {
			sandbox.createdAt = now;
		}
		if (!sandbox.updatedAt) {
			sandbox.updatedAt = now;
		}

		sandbox.assertValid();
		sandbox.enforceInvariants();
	}

	private async persistInsert(
		entityManager: EntityManager,
		sandbox: Sandbox,
		{ parentId, persistRelated, locality, runtimeIntent }: InsertOptions
	): Promise<void> {
		await observeOperation(
			'sandbox.persistence.insert',
			{
				'sandbox.class': sandbox.sandboxClass,
				'sandbox.mode': sandbox.mode,
			},
			async () => {
				entityManager.persist(sandbox);
				await entityManager.flush();
				if (runtimeIntent) {
					await this.applyInsertedRuntimeIntent(
						entityManager,
						sandbox,
						runtimeIntent
					);
				}
				const revisedMachineIds = desiredStateMachineIds(null, sandbox);
				await this.sandboxPlacementService.synchronizeAssignment(
					entityManager,
					sandbox,
					{ revisedMachineIds, locality }
				);
				await this.desiredStateRevisions.advance(
					entityManager,
					revisedMachineIds
				);
				const lastActivity = await this.upsertLastActivity(
					entityManager,
					sandbox.id,
					sandbox.createdAt
				);
				sandbox.lastActivityAt = lastActivity;
				await publishWebhook(entityManager, sandboxCreatedWebhook(sandbox));

				if (parentId) {
					entityManager.persist(
						entityManager.create(SandboxFork, {
							id: randomUUID(),
							parentId,
							childId: sandbox.id,
							createdAt: sandbox.createdAt,
						})
					);
				}
				if (persistRelated) await persistRelated(entityManager);
				await this.eventEmitter.emitAsync(
					SandboxPersistenceEvents.CREATED,
					new SandboxPersistedEvent(entityManager, sandbox)
				);
			}
		);
	}

	private async applyInsertedRuntimeIntent(
		entityManager: EntityManager,
		sandbox: Sandbox,
		source: (machineId: string) => Promise<SandboxRuntimeIntent>
	): Promise<void> {
		Object.assign(sandbox, await this.runtimeIntentChanges(sandbox, source));
		sandbox.enforceInvariants();
		await entityManager.flush();
	}

	async update(
		id: string,
		params: {
			updateData: Partial<Sandbox>;
			entity?: Sandbox;
			reserveMachine?: MachineReservation;
			runtimeIntent?: RuntimeIntentSource;
			priceEndReason?: PriceEndReason;
		}
	): Promise<Sandbox> {
		const {
			updateData,
			entity,
			reserveMachine,
			runtimeIntent,
			priceEndReason,
		} = params;

		const sandbox =
			entity ?? (await this.entityManager.findOne(Sandbox, { id }));
		if (!sandbox) {
			throw new SandboxNotFoundException();
		}

		const persistedGuard = persistedConcurrencyGuard(
			sandbox,
			this.entityManager.getUnitOfWork().getOriginalEntityData(sandbox)
		);
		const previousSandbox = { ...sandbox, ...persistedGuard };
		const inMemory = { ...sandbox };
		try {
			await this.entityManager.transactional(
				async (entityManager) => {
					const changes: Partial<Sandbox> = { ...updateData };
					let locality: PlacementLocality | undefined;
					let restoreFromBackup: string | undefined;
					if (reserveMachine) {
						await lockRowIdsForNoKeyUpdate(entityManager, Sandbox, [
							sandbox.id,
						]);
						await this.sandboxPlacementService.lockPlacement(
							entityManager,
							sandbox.id
						);
						// biome-ignore lint/nursery/useAwaitThenable: Biome does not infer return types through function type aliases; MachineReservation returns a Promise
						const reserved = await reserveMachine(
							entityManager,
							previousSandbox.machineId ? [previousSandbox.machineId] : []
						);
						changes.machineId = reserved.machine.id;
						changes.country = reserved.machine.country;
						changes.continent = reserved.machine.continent;
						changes.city = reserved.machine.city;
						if (reserved.wholeMachineShape) {
							changes.cpu = reserved.wholeMachineShape.cpu;
							changes.mem = reserved.wholeMachineShape.memoryGiB;
							changes.gpu = reserved.wholeMachineShape.gpu;
						}
						locality = reserved.locality;
					}
					if (runtimeIntent) {
						const next = { ...previousSandbox, ...changes };
						const intent = await this.resolveRuntimeIntent(next, runtimeIntent);
						Object.assign(changes, runtimeIntentUpdate(next, intent));
						restoreFromBackup = intent.restoreFromBackup;
					}
					const nextSandbox = { ...previousSandbox, ...changes };
					assertSandboxDesiredStateAcceptsState(nextSandbox);
					assertAbuseHoldAllowsStart(previousSandbox, nextSandbox);
					Object.assign(changes, getSandboxInvariantChanges(nextSandbox), {
						updatedAt: new Date(),
					});
					await this.persistGuardedUpdate(
						entityManager,
						sandbox.id,
						persistedGuard,
						changes,
						startsRuntime(previousSandbox, nextSandbox)
					);
					Object.assign(sandbox, persistedGuard, changes);
					await this.synchronizeUpdatedSandbox(
						entityManager,
						sandbox,
						previousSandbox,
						{ locality, priceEndReason, restoreFromBackup }
					);
				},
				{ propagation: TransactionPropagation.REQUIRED }
			);
		} catch (error) {
			Object.assign(sandbox, inMemory);
			throw error;
		}
		this.entityManager.getUnitOfWork().merge(sandbox);

		this.emitUpdateEvents(sandbox, previousSandbox);
		return sandbox;
	}

	async updateWhere(
		id: string,
		params: {
			updateData: Partial<Sandbox>;
			whereCondition: FilterQuery<Sandbox>;
			runtimeIntent?: SandboxRuntimeIntent;
		}
	): Promise<Sandbox> {
		const { updateData, whereCondition, runtimeIntent } = params;

		const result = await this.entityManager.transactional(
			async (entityManager) => {
				const [sandbox] = await lockRowsForNoKeyUpdate(
					entityManager,
					Sandbox,
					[id],
					whereCondition
				);
				if (!sandbox) {
					throw new SandboxConflictException();
				}

				const previousSandbox = { ...sandbox };
				Object.assign(sandbox, updateData);
				if (runtimeIntent) {
					Object.assign(
						sandbox,
						runtimeIntentUpdate(previousSandbox, runtimeIntent)
					);
				}
				sandbox.assertValid();
				assertAbuseHoldAllowsStart(previousSandbox, sandbox);
				sandbox.enforceInvariants();
				sandbox.updatedAt = new Date();
				await this.synchronizeUpdatedSandbox(
					entityManager,
					sandbox,
					previousSandbox
				);
				await entityManager.flush();
				return { sandbox, previousSandbox };
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		this.emitUpdateEvents(result.sandbox, result.previousSandbox);
		return result.sandbox;
	}

	private async persistGuardedUpdate(
		entityManager: EntityManager,
		id: string,
		persistedGuard: ReturnType<typeof persistedConcurrencyGuard>,
		changes: Partial<Sandbox>,
		starting: boolean
	): Promise<void> {
		const affected = await entityManager.nativeUpdate(
			Sandbox,
			{ id, ...persistedGuard, ...(starting && { abuseHold: false }) },
			changes
		);
		if (affected > 0) return;
		if (
			starting &&
			(await entityManager.count(Sandbox, { id, abuseHold: true })) > 0
		) {
			throw new SandboxAbuseHoldException();
		}
		throw new SandboxConflictException();
	}

	private async runtimeIntentChanges(
		next: Pick<Sandbox, 'id' | 'machineId' | 'specGeneration'>,
		source: RuntimeIntentSource
	): Promise<Partial<Sandbox>> {
		return runtimeIntentUpdate(
			next,
			await this.resolveRuntimeIntent(next, source)
		);
	}

	private async resolveRuntimeIntent(
		next: Pick<Sandbox, 'id' | 'machineId'>,
		source: RuntimeIntentSource
	): Promise<SandboxRuntimeIntent> {
		if (!next.machineId) {
			throw new Error(
				`Sandbox ${next.id} has no machine to converge a runtime intent`
			);
		}
		return typeof source === 'function' ? source(next.machineId) : source;
	}

	private async synchronizeUpdatedSandbox(
		entityManager: EntityManager,
		sandbox: Sandbox,
		previousSandbox: SandboxSnapshot,
		placement: Pick<
			SynchronizePlacementOptions,
			'locality' | 'priceEndReason' | 'restoreFromBackup'
		> = {}
	): Promise<void> {
		const revisedMachineIds = desiredStateMachineIds(previousSandbox, sandbox);
		await this.sandboxPlacementService.synchronizeAssignment(
			entityManager,
			sandbox,
			{
				...placementSynchronizationOptions(previousSandbox, sandbox),
				revisedMachineIds,
				...placement,
			}
		);
		await this.desiredStateRevisions.advance(entityManager, revisedMachineIds);
		if (previousSandbox.state === sandbox.state) return;
		sandbox.lastActivityAt = await this.upsertLastActivity(
			entityManager,
			sandbox.id,
			sandbox.updatedAt
		);
		for (const publication of sandboxStateWebhooks(sandbox, previousSandbox)) {
			await publishWebhook(entityManager, publication);
		}
		if (ATTACHMENT_RELEASING_STATES.has(sandbox.state)) {
			await this.volumeAttachments.releaseAttachments(
				entityManager,
				sandbox.id
			);
		}
	}

	private async upsertLastActivity(
		entityManager: EntityManager,
		sandboxId: string,
		lastActivityAt: Date
	): Promise<SandboxLastActivity> {
		return entityManager.upsert(
			SandboxLastActivity,
			{ sandbox: sandboxId, lastActivityAt },
			{ onConflictFields: ['sandbox'] }
		);
	}

	private emitUpdateEvents(
		updatedSandbox: Sandbox,
		previousSandbox: Parameters<typeof sandboxUpdateEvents>[1]
	): void {
		for (const [name, payload] of sandboxUpdateEvents(
			updatedSandbox,
			previousSandbox
		)) {
			this.committedEvents.publish(name, payload);
		}
	}
}
