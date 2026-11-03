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
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
	SandboxLifecycle,
	type SandboxObservedStatus,
	SandboxRuntimeState,
} from '@snapflow/machine-proto';
import { truncateErrorMessage } from '../../../../common/utils/error/truncate-error-message.util';
import { millisecondsBetween } from '../../../../common/utils/time.util';
import { recordOperationDuration } from '../../../../infra/logging/utils/operation-observability.util';
import { OrganizationUsageService } from '../../../../organization/tenant/services/organization-usage.service';
import { MACHINE_OBSERVED_STATUS_LIMITS } from '../../../machine/constants/machine-desired-state.constants';
import {
	decodeSandboxDirectives,
	type SandboxRuntimeIntent,
} from '../../../machine/utils/proto/sandbox-runtime-intent.util';
import { decodeSandboxSpec } from '../../../machine/utils/proto/sandbox-runtime-spec.util';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { VolumeAttachmentService } from '../../../volume/services/volume-attachment.service';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import {
	OBSERVED_TRANSITION,
	type ObservedTransition,
} from '../../constants/sandbox-state-machine.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxStartedEvent } from '../../events/sandbox-started.event';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { runtimeConvergenceErrorReason } from '../../utils/runtime/runtime-convergence.util';
import { SandboxStateMachine } from '../../values/sandbox-state-machine.value';

const RESETTABLE_BACKUP_STATES: ReadonlySet<BackupState> = new Set([
	BackupState.ERROR,
	BackupState.COMPLETED,
]);

const RESIZE_USAGE_DELTA = { cpu: 0, memory: 0, gpu: 0 } as const;

const EXITED_INTENT: SandboxRuntimeIntent = {
	lifecycle: SandboxLifecycle.STOPPED,
};

interface ProjectionContext {
	sandbox: Sandbox;
	status: SandboxObservedStatus;
}

type TransitionHandler = (context: ProjectionContext) => Promise<Sandbox>;

@Injectable()
export class SandboxObservedStatusProjector {
	private readonly logger = new Logger(SandboxObservedStatusProjector.name);
	private readonly handlers: Readonly<
		Record<
			Exclude<ObservedTransition, typeof OBSERVED_TRANSITION.NONE>,
			TransitionHandler
		>
	> = {
		[OBSERVED_TRANSITION.STARTED]: (context) => this.started(context),
		[OBSERVED_TRANSITION.STOPPED]: ({ sandbox }) =>
			this.apply(sandbox, {
				state: SandboxState.STOPPED,
				errorReason: null,
				...Sandbox.getBackupStateUpdate(sandbox, BackupState.NONE),
			}),
		[OBSERVED_TRANSITION.MIGRATED]: ({ sandbox }) =>
			this.apply(sandbox, {
				state: SandboxState.STOPPED,
				errorReason: null,
				prevMachineId: null,
			}),
		[OBSERVED_TRANSITION.RESIZED]: (context) => this.resized(context),
		[OBSERVED_TRANSITION.RECOVERED]: (context) => this.recovered(context),
		[OBSERVED_TRANSITION.PAUSED]: ({ sandbox }) =>
			this.apply(sandbox, { state: SandboxState.PAUSED, errorReason: null }),
		[OBSERVED_TRANSITION.DESTROYED]: ({ sandbox }) =>
			this.removed(sandbox, {
				state: SandboxState.DESTROYED,
				errorReason: null,
			}),
		[OBSERVED_TRANSITION.ARCHIVED]: ({ sandbox }) =>
			this.removed(sandbox, {
				state: SandboxState.ARCHIVED,
				machineId: null,
				errorReason: null,
				recoverable: false,
			}),
		[OBSERVED_TRANSITION.EXITED]: ({ sandbox }) =>
			this.apply(
				sandbox,
				{
					state: SandboxState.STOPPED,
					desiredState: SandboxDesiredState.STOPPED,
					recoverable: false,
				},
				EXITED_INTENT
			),
		[OBSERVED_TRANSITION.FAILED]: (context) =>
			this.apply(context.sandbox, this.failure(context)),
		[OBSERVED_TRANSITION.CREATE_FAILED]: (context) =>
			this.apply(context.sandbox, {
				...this.failure(context),
				machineId: null,
			}),
		[OBSERVED_TRANSITION.MIGRATION_FAILED]: ({ sandbox }) =>
			this.apply(sandbox, {
				state: SandboxState.STOPPED,
				machineId: null,
				prevMachineId: null,
			}),
		[OBSERVED_TRANSITION.RESIZE_FAILED]: (context) =>
			this.resizeFailed(context),
		[OBSERVED_TRANSITION.RECOVERY_FAILED]: (context) =>
			this.recoveryFailed(context),
	};

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly organizationUsageService: OrganizationUsageService,
		private readonly volumeAttachmentService: VolumeAttachmentService,
		private readonly eventEmitter: EventEmitter2
	) {}

	async project(status: SandboxObservedStatus): Promise<ObservedTransition> {
		const sandbox = await this.entityManager.findOne(
			Sandbox,
			{ id: status.sandboxId },
			{ populate: ['runtimeSpec', 'runtimeDirectives'], refresh: true }
		);
		if (!sandbox) return OBSERVED_TRANSITION.NONE;
		const transition = new SandboxStateMachine({
			state: sandbox.state,
			desiredState: sandbox.desiredState,
			specGeneration: sandbox.specGeneration,
			runtimeLifecycle: sandbox.runtimeLifecycle,
			backupState: sandbox.backupState,
			recoveryRequested:
				decodeSandboxDirectives(sandbox.runtimeDirectives).recovery !==
				undefined,
		}).transitionFor({
			state: status.state,
			observedSpecGeneration: status.observedSpecGeneration,
		});
		if (transition === OBSERVED_TRANSITION.NONE) return transition;
		this.logger.debug(
			`Sandbox ${sandbox.id} observed ${SandboxRuntimeState[status.state]} at generation ${status.observedSpecGeneration}: ${transition}`
		);
		await this.handlers[transition]({ sandbox, status });
		return transition;
	}

	private async started({
		sandbox,
		status,
	}: ProjectionContext): Promise<Sandbox> {
		const started = await this.apply(sandbox, {
			state: SandboxState.STARTED,
			errorReason: null,
			recoverable: false,
			prevMachineId: null,
			...(status.daemonVersion && { daemonVersion: status.daemonVersion }),
			...this.backupReset(sandbox),
		});
		if (sandbox.state === SandboxState.CREATING) {
			recordOperationDuration(
				'sandbox.await_started',
				Math.max(0, millisecondsBetween(sandbox.createdAt, started.updatedAt)),
				{ 'sandbox.lifecycle': 'create' }
			);
		}
		return started;
	}

	private async resized({ sandbox }: ProjectionContext): Promise<Sandbox> {
		const resources = this.requestedResources(sandbox);
		await this.organizationUsageService.applyResizeUsageChange(
			sandbox.organizationId,
			sandbox.sandboxClass,
			RESIZE_USAGE_DELTA.cpu,
			RESIZE_USAGE_DELTA.memory,
			resources.disk - sandbox.disk,
			RESIZE_USAGE_DELTA.gpu
		);
		return this.apply(sandbox, { ...resources, state: SandboxState.STOPPED });
	}

	private async resizeFailed({ sandbox }: ProjectionContext): Promise<Sandbox> {
		const diskDelta = this.requestedResources(sandbox).disk - sandbox.disk;
		if (diskDelta !== 0) {
			await this.organizationUsageService.decrementPendingSandboxUsage(
				sandbox.organizationId,
				sandbox.sandboxClass,
				undefined,
				undefined,
				diskDelta
			);
		}
		return this.apply(sandbox, { state: SandboxState.STOPPED });
	}

	private async recovered({ sandbox }: ProjectionContext): Promise<Sandbox> {
		const updated = await this.apply(sandbox, {
			state: SandboxState.STOPPED,
			errorReason: null,
			recoverable: false,
			...this.backupReset(sandbox),
		});
		if (updated.desiredState === SandboxDesiredState.STARTED) {
			this.eventEmitter.emit(
				SandboxEvents.STARTED,
				new SandboxStartedEvent(updated)
			);
		}
		return updated;
	}

	private async recoveryFailed(context: ProjectionContext): Promise<Sandbox> {
		const { sandbox } = context;
		const startRequested = sandbox.desiredState === SandboxDesiredState.STARTED;
		await this.organizationUsageService.decrementPendingSandboxUsage(
			sandbox.organizationId,
			sandbox.sandboxClass,
			startRequested ? sandbox.cpu : undefined,
			startRequested ? sandbox.mem : undefined,
			sandbox.disk,
			startRequested ? sandbox.gpu : undefined
		);
		return this.apply(sandbox, this.failure(context));
	}

	private async removed(
		sandbox: Sandbox,
		updateData: Partial<Sandbox>
	): Promise<Sandbox> {
		const removed = await this.apply(sandbox, updateData);
		await this.volumeAttachmentService.releaseAttachments(sandbox.id);
		return removed;
	}

	private failure({ sandbox, status }: ProjectionContext): Partial<Sandbox> {
		return {
			state: SandboxState.ERROR,
			errorReason: truncateErrorMessage(
				runtimeConvergenceErrorReason(
					sandbox.runtimeLifecycle,
					status.state,
					status.errorReason
				),
				MACHINE_OBSERVED_STATUS_LIMITS.maximumErrorReasonLength
			),
			recoverable:
				status.state === SandboxRuntimeState.ERROR && status.recoverable,
		};
	}

	private backupReset(sandbox: Sandbox): Partial<Sandbox> {
		return RESETTABLE_BACKUP_STATES.has(sandbox.backupState)
			? Sandbox.getBackupStateUpdate(sandbox, BackupState.NONE)
			: {};
	}

	private requestedResources(
		sandbox: Sandbox
	): Pick<Sandbox, 'cpu' | 'mem' | 'disk'> {
		if (!sandbox.runtimeSpec) {
			throw new Error(`Sandbox ${sandbox.id} has no runtime spec`);
		}
		const resources = decodeSandboxSpec(sandbox.runtimeSpec).resources;
		if (!resources) {
			throw new Error(`Runtime spec of sandbox ${sandbox.id} has no resources`);
		}
		return {
			cpu: resources.cpuQuota,
			mem: resources.memoryQuota,
			disk: resources.storageQuota,
		};
	}

	private apply(
		sandbox: Sandbox,
		updateData: Partial<Sandbox>,
		runtimeIntent?: SandboxRuntimeIntent
	): Promise<Sandbox> {
		return this.sandboxRepository.updateWhere(sandbox.id, {
			updateData,
			whereCondition: {
				state: sandbox.state,
				specGeneration: sandbox.specGeneration,
				machineId: sandbox.machineId,
			},
			runtimeIntent,
		});
	}
}
