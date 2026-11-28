/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import {
	MachineErrorCode,
	SandboxLifecycle,
	type SandboxObservedStatus,
	SandboxRuntimeState,
} from '@snapflow/machine-proto';
import { FundingNoticeKind } from '../../../billing/constants/funding.constants';
import { FundingNoticeEvent } from '../../../billing/events/funding-notice.event';
import { truncateErrorMessage } from '../../../common/utils/error/truncate-error-message.util';
import { millisecondsBetween } from '../../../common/utils/time.util';
import { CommittedEventPublisher } from '../../../infra/database/services/committed-event-publisher.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { recordOperationDuration } from '../../../infra/logging/utils/operation-observability.util';
import { MACHINE_OBSERVED_STATUS_LIMITS } from '../../../machine/constants/machine-desired-state.constants';
import { consecutiveConvergenceFailures } from '../../../machine/queries/sandbox-convergence-failure.query';
import {
	decodeSandboxDirectives,
	type SandboxRuntimeIntent,
} from '../../../machine/utils/proto/sandbox-runtime-intent.util';
import { decodeSandboxSpec } from '../../../machine/utils/proto/sandbox-runtime-spec.util';
import { JobErrorCode } from '../../../machine-job/enums/job-error-code.enum';
import { NOTICE_COOLDOWN_SECONDS } from '../../../notification/constants/notice.constants';
import {
	cooldownNoticeKey,
	enqueueFundingNotice,
} from '../../../notification/utils/notice-outbox.util';
import { OrganizationUsageService } from '../../../organization/services/usage/organization-usage.service';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import {
	OBSERVED_TRANSITION,
	type ObservedTransition,
	TIMED_OUT_START_ATTEMPTS,
	UNEXPECTED_STOP_DEFAULT_REASON,
} from '../../constants/sandbox-state-machine.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxStartedEvent } from '../../events/sandbox-started.event';
import { SandboxStoppedEvent } from '../../events/sandbox-stopped.event';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { runtimeConvergenceErrorReason } from '../../utils/runtime/runtime-convergence.util';
import { SandboxStateMachine } from '../../values/sandbox-state-machine.value';
import { SandboxStartWaitService } from '../lifecycle/sandbox-start-wait.service';
import { SandboxNetworkControlService } from '../sandbox/sandbox-network-control.service';

const RESETTABLE_BACKUP_STATES: ReadonlySet<BackupState> = new Set([
	BackupState.ERROR,
	BackupState.COMPLETED,
]);

const RESIZE_USAGE_DELTA = { cpu: 0, memory: 0, gpu: 0 } as const;

const STOPPED_INTENT: SandboxRuntimeIntent = {
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
				stopReason: null,
				...Sandbox.getBackupStateUpdate(BackupState.NONE),
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
		[OBSERVED_TRANSITION.HELD_FOR_PAYMENT]: (context) =>
			this.heldForPayment(context),
		[OBSERVED_TRANSITION.DESTROYED]: ({ sandbox }) =>
			this.apply(sandbox, {
				state: SandboxState.DESTROYED,
				errorReason: null,
			}),
		[OBSERVED_TRANSITION.ARCHIVED]: ({ sandbox }) =>
			this.apply(sandbox, {
				state: SandboxState.ARCHIVED,
				machineId: null,
				errorReason: null,
				recoverable: false,
			}),
		[OBSERVED_TRANSITION.STOPPED_UNEXPECTEDLY]: (context) =>
			this.stoppedUnexpectedly(context),
		[OBSERVED_TRANSITION.FAILED]: (context) =>
			this.apply(context.sandbox, this.failure(context)),
		[OBSERVED_TRANSITION.CREATE_FAILED]: (context) =>
			this.apply(context.sandbox, {
				...this.failure(context),
				machineId: null,
			}),
		[OBSERVED_TRANSITION.START_RETRY]: (context) => this.retryStart(context),
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
		private readonly committedEvents: CommittedEventPublisher,
		private readonly networkControls: SandboxNetworkControlService,
		private readonly startWaits: SandboxStartWaitService
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
			pausedForPayment: sandbox.pausedForPayment,
			recoveryRequested:
				decodeSandboxDirectives(sandbox.runtimeDirectives).recovery !==
				undefined,
		}).transitionFor(status);
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
			stopReason: null,
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
		return started.abuseHold
			? this.stopHeld(started)
			: this.networkControls.converge(started);
	}

	private async stopHeld(sandbox: Sandbox): Promise<Sandbox> {
		const stopped = await this.apply(sandbox, {
			desiredState: SandboxDesiredState.STOPPED,
			pending: true,
		});
		this.committedEvents.publish(
			SandboxEvents.STOPPED,
			new SandboxStoppedEvent(stopped, true)
		);
		return stopped;
	}

	private stoppedUnexpectedly({
		sandbox,
		status,
	}: ProjectionContext): Promise<Sandbox> {
		const stopped = {
			state: SandboxState.STOPPED,
			stopReason: truncateErrorMessage(
				status.stopReason ?? UNEXPECTED_STOP_DEFAULT_REASON,
				MACHINE_OBSERVED_STATUS_LIMITS.maximumStopReasonLength
			),
			errorReason: null,
			recoverable: false,
		};
		if (
			status.restarting &&
			!sandbox.abuseHold &&
			sandbox.desiredState === SandboxDesiredState.STARTED
		) {
			return this.apply(sandbox, stopped);
		}
		return this.apply(
			sandbox,
			{ ...stopped, desiredState: SandboxDesiredState.STOPPED },
			STOPPED_INTENT
		);
	}

	private async retryStart(context: ProjectionContext): Promise<Sandbox> {
		if (await this.startAttemptsExhausted(context)) {
			return this.handlers[
				context.sandbox.state === SandboxState.CREATING
					? OBSERVED_TRANSITION.CREATE_FAILED
					: OBSERVED_TRANSITION.FAILED
			](context);
		}
		return this.returnToStartOrigin(context.sandbox);
	}

	private async startAttemptsExhausted({
		sandbox,
		status,
	}: ProjectionContext): Promise<boolean> {
		return (
			status.result?.errorCode === MachineErrorCode.DEADLINE_EXCEEDED &&
			(await consecutiveConvergenceFailures(
				this.entityManager,
				sandbox.id,
				JobErrorCode.DEADLINE_EXCEEDED
			)) >= TIMED_OUT_START_ATTEMPTS
		);
	}

	private async returnToStartOrigin(sandbox: Sandbox): Promise<Sandbox> {
		const startWaitUntil =
			sandbox.startWaitUntil ?? (await this.startWaits.deadline());
		if (sandbox.state === SandboxState.STARTING) {
			return this.apply(
				sandbox,
				{ state: SandboxState.STOPPED, startWaitUntil },
				STOPPED_INTENT
			);
		}
		return this.apply(
			sandbox,
			sandbox.snapshot === null
				? { state: SandboxState.PENDING_BUILD, machineId: null }
				: {
						state: SandboxState.PENDING_PLACEMENT,
						machineId: null,
						startWaitUntil,
					}
		);
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
			this.committedEvents.publish(
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

	private heldForPayment({ sandbox }: ProjectionContext): Promise<Sandbox> {
		return this.entityManager.transactional(
			async (manager) => {
				const held = await this.apply(sandbox, {
					state: SandboxState.PAUSED,
					pausedForPayment: true,
					errorReason: null,
					recoverable: false,
				});
				await manager.flush();
				const { paymentHoldLimit } = await manager.findOneOrFail(
					Sandbox,
					{ id: held.id },
					{ fields: ['paymentHoldLimit'], refresh: true }
				);
				const observedAt = await databaseNow(manager);
				const kind = FundingNoticeKind.SANDBOX_PAUSED_FOR_PAYMENT;
				await enqueueFundingNotice(
					manager,
					new FundingNoticeEvent(
						held.organizationId,
						cooldownNoticeKey(
							observedAt,
							NOTICE_COOLDOWN_SECONDS.paymentHold,
							kind,
							held.id
						),
						{
							kind,
							sandboxId: held.id,
							sandboxName: held.name,
							reason: paymentHoldLimit,
						},
						observedAt
					)
				);
				return held;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
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
			? Sandbox.getBackupStateUpdate(BackupState.NONE)
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
			updateData: { pausedForPayment: false, ...updateData },
			whereCondition: {
				state: sandbox.state,
				specGeneration: sandbox.specGeneration,
				machineId: sandbox.machineId,
			},
			runtimeIntent,
		});
	}
}
