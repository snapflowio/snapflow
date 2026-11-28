/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable } from '@nestjs/common';
import { SandboxLifecycle } from '@snapflow/machine-proto';
import { apiError } from '../../../common/utils/error/api-error.util';
import { CommittedEventPublisher } from '../../../infra/database/services/committed-event-publisher.service';
import { OrganizationService } from '../../../organization/services/organization.service';
import { OrganizationLimitsService } from '../../../organization/services/organization-limits.service';
import { OrganizationStorageCapService } from '../../../organization/services/organization-storage-cap.service';
import {
	type PlacementUpdate,
	SandboxPlacementControlService,
} from '../../../placement/services/sandbox-placement-control.service';
import { SandboxPlacementResolverService } from '../../../placement/services/sandbox-placement-resolver.service';
import {
	type PendingQuotaUsage,
	pendingQuotaUsage,
	sandboxQuotaUsage,
} from '../../../placement/utils/pending-quota-usage.util';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import { START_ORIGIN_DESIRED_STATES } from '../../constants/sandbox-state-machine.constants';
import type {
	MoveSandboxDto,
	StartSandboxDto,
} from '../../dto/sandbox-placement.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxArchivedEvent } from '../../events/sandbox-archived.event';
import { SandboxDestroyedEvent } from '../../events/sandbox-destroyed.event';
import { SandboxStartedEvent } from '../../events/sandbox-started.event';
import { SandboxStoppedEvent } from '../../events/sandbox-stopped.event';
import { SandboxAbuseHoldException } from '../../exceptions/sandbox-abuse-hold.exception';
import { StateChangeInProgressException } from '../../exceptions/state-change-in-progress.exception';
import { SandboxPriceChangeManager } from '../../managers/sandbox-price-change.manager';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import {
	deletesImmediatelyOnStop,
	isEphemeral,
} from '../../utils/runtime/ephemeral.util';
import { SandboxAdmissionService } from '../admission/sandbox-admission.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { SandboxQuotaService } from '../sandbox/sandbox-quota.service';
import {
	SandboxStartWaitService,
	startOriginDesiredState,
} from './sandbox-start-wait.service';

const STARTABLE_STATES: readonly SandboxState[] = [
	...START_ORIGIN_DESIRED_STATES.keys(),
];

const ABUSE_HOLD_STOPPED_STATES: ReadonlySet<SandboxDesiredState> = new Set([
	SandboxDesiredState.STARTED,
	SandboxDesiredState.PAUSED,
]);

@Injectable()
export class SandboxLifecycleService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxService: SandboxService,
		private readonly sandboxRepository: SandboxRepository,
		private readonly quota: SandboxQuotaService,
		private readonly organizationLimitsService: OrganizationLimitsService,
		private readonly organizations: OrganizationService,
		private readonly placements: SandboxPlacementResolverService,
		private readonly placementControl: SandboxPlacementControlService,
		private readonly priceChanges: SandboxPriceChangeManager,
		private readonly storageCap: OrganizationStorageCapService,
		private readonly startWaits: SandboxStartWaitService,
		private readonly admission: SandboxAdmissionService,
		private readonly committedEvents: CommittedEventPublisher
	) {}

	async archive(
		sandboxIdOrName: string,
		organizationId: string
	): Promise<Sandbox> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);

		assertSandboxNotErrored(sandbox);

		if (String(sandbox.state) !== String(sandbox.desiredState)) {
			throw new StateChangeInProgressException();
		}

		if (sandbox.state !== SandboxState.STOPPED) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.STATE_INVALID,
					'Only a stopped sandbox can be archived. Stop the sandbox, then archive it.'
				)
			);
		}

		if (sandbox.pending) {
			throw new StateChangeInProgressException();
		}

		if (isEphemeral(sandbox)) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.MODE_INVALID,
					'Ephemeral sandboxes cannot be archived. Delete the sandbox instead.'
				)
			);
		}

		await this.storageCap.assertAvailable(sandbox.organizationId);

		const updatedSandbox = await this.sandboxRepository.updateWhere(
			sandbox.id,
			{
				updateData: {
					state: SandboxState.ARCHIVING,
					desiredState: SandboxDesiredState.ARCHIVED,
					fundsStoppedAt: null,
				},
				whereCondition: { pending: false, state: SandboxState.STOPPED },
			}
		);

		this.committedEvents.publish(
			SandboxEvents.ARCHIVED,
			new SandboxArchivedEvent(updatedSandbox)
		);
		return updatedSandbox;
	}

	async destroy(
		sandboxIdOrName: string,
		organizationId: string
	): Promise<Sandbox> {
		const found = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		const sandbox = (await this.withdrawStart(found)) ?? found;

		if (
			sandbox.pending &&
			sandbox.state !== SandboxState.PENDING_BUILD &&
			sandbox.state !== SandboxState.PENDING_PLACEMENT
		) {
			throw new StateChangeInProgressException();
		}

		const [activeChild] = await this.entityManager.execute<
			{ exists: boolean }[]
		>(
			`SELECT EXISTS (
				SELECT 1
				FROM sandbox_fork fork
				INNER JOIN sandbox child ON child.id = fork."childId"
				WHERE fork."parentId" = ? AND child."desiredState" <> ?
			) AS exists`,
			[sandbox.id, SandboxDesiredState.DESTROYED]
		);
		if (activeChild?.exists) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.HAS_FORKS,
					'The sandbox has active forks. Delete its forks first, then delete the sandbox.'
				)
			);
		}

		const updatedSandbox = await this.sandboxRepository.updateWhere(
			sandbox.id,
			{
				updateData: Sandbox.getSoftDeleteUpdate(sandbox),
				whereCondition: { pending: sandbox.pending, state: sandbox.state },
			}
		);

		this.committedEvents.publish(
			SandboxEvents.DESTROYED,
			new SandboxDestroyedEvent(updatedSandbox)
		);
		return updatedSandbox;
	}

	async start(
		sandboxIdOrName: string,
		organizationId: string,
		input: StartSandboxDto
	): Promise<Sandbox> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		if (
			sandbox.state === SandboxState.STARTED &&
			sandbox.desiredState === SandboxDesiredState.STARTED
		) {
			return sandbox;
		}
		assertSandboxStartable(sandbox);
		await this.priceChanges.applyBeforeStart(sandbox.id);
		return this.requestStart(
			sandbox,
			organizationId,
			await this.placementControl.prepareStart(sandbox, input)
		);
	}

	async move(
		sandboxIdOrName: string,
		organizationId: string,
		input: MoveSandboxDto
	): Promise<Sandbox> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		assertSandboxStartable(sandbox);
		return this.requestStart(
			sandbox,
			organizationId,
			await this.placementControl.prepareMove(sandbox, input)
		);
	}

	private async requestStart(
		sandbox: Sandbox,
		organizationId: string,
		placement: PlacementUpdate
	): Promise<Sandbox> {
		let pending: PendingQuotaUsage = {};
		try {
			await this.organizations.assertActive(organizationId);
			const ownMachinesOnly = await this.placements.runsOnOwnMachines({
				...sandbox,
				...placement,
			});
			await this.admission.assertPaymentsSignable(sandbox, ownMachinesOnly);

			const usage = sandboxQuotaUsage(sandbox);
			const reservation = await this.quota.validateOrganizationQuotas({
				organizationLimits:
					await this.organizationLimitsService.get(organizationId),
				sandboxClass: sandbox.sandboxClass,
				usage,
				ephemeral: isEphemeral(sandbox),
				ownMachinesOnly,
				excludeSandboxId: sandbox.id,
			});
			pending = pendingQuotaUsage(reservation, usage);

			const updatedSandbox = await this.sandboxRepository.updateWhere(
				sandbox.id,
				{
					updateData: {
						...placement,
						pending: true,
						desiredState: SandboxDesiredState.STARTED,
						stopReason: null,
						fundsStoppedAt: null,
						preemptedAt: null,
						startWaitUntil: await this.startWaits.deadline(),
					},
					whereCondition: { pending: false, state: sandbox.state },
				}
			);

			this.committedEvents.publish(
				SandboxEvents.STARTED,
				new SandboxStartedEvent(updatedSandbox)
			);

			return updatedSandbox;
		} catch (error) {
			await this.quota.rollbackPendingUsage(
				organizationId,
				sandbox.sandboxClass,
				pending.cpu,
				pending.memory,
				pending.disk,
				pending.gpu
			);
			throw error;
		}
	}

	async stop(
		sandboxIdOrName: string,
		organizationId: string,
		force?: boolean
	): Promise<Sandbox> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);

		const withdrawn = await this.withdrawStart(sandbox);
		if (withdrawn) return withdrawn;

		if (sandbox.awaitsAutomaticRestart()) {
			return this.cancelAutomaticRestart(sandbox, force);
		}

		assertSandboxNotErrored(sandbox);

		if (String(sandbox.state) !== String(sandbox.desiredState)) {
			throw new StateChangeInProgressException();
		}

		if (
			sandbox.state !== SandboxState.STARTED &&
			sandbox.state !== SandboxState.PAUSED
		) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.STATE_INVALID,
					'Only a started or paused sandbox can be stopped. Check the sandbox state and try again.'
				)
			);
		}

		if (sandbox.pending) {
			throw new StateChangeInProgressException();
		}

		const deleteOnStop = deletesImmediatelyOnStop(sandbox);
		const updatedSandbox = await this.sandboxRepository.updateWhere(
			sandbox.id,
			{
				updateData: deleteOnStop
					? Sandbox.getSoftDeleteUpdate(sandbox)
					: {
							pending: true,
							desiredState: SandboxDesiredState.STOPPED,
							fundsStoppedAt: null,
						},
				whereCondition: { pending: false, state: sandbox.state },
			}
		);

		if (deleteOnStop) {
			this.committedEvents.publish(
				SandboxEvents.DESTROYED,
				new SandboxDestroyedEvent(updatedSandbox)
			);
		} else {
			this.committedEvents.publish(
				SandboxEvents.STOPPED,
				new SandboxStoppedEvent(updatedSandbox, force)
			);
		}

		return updatedSandbox;
	}

	async holdForAbuse(sandboxId: string): Promise<void> {
		const held = await this.sandboxRepository.updateWhere(sandboxId, {
			updateData: { abuseHold: true },
			whereCondition: { state: { $ne: SandboxState.DESTROYED } },
		});
		if (held.isErrored() || !ABUSE_HOLD_STOPPED_STATES.has(held.desiredState)) {
			return;
		}
		try {
			await this.stop(held.id, held.organizationId, true);
		} catch (error) {
			if (!(error instanceof StateChangeInProgressException)) throw error;
		}
	}

	async cancelHeldStart(sandbox: Sandbox): Promise<void> {
		if (await this.startWaits.withdraw(sandbox)) return;
		await this.cancelAutomaticRestart(sandbox, true);
	}

	private async cancelAutomaticRestart(
		sandbox: Sandbox,
		force?: boolean
	): Promise<Sandbox> {
		const stopped = await this.sandboxRepository.updateWhere(sandbox.id, {
			updateData: {
				desiredState: SandboxDesiredState.STOPPED,
				pending: false,
				startWaitUntil: null,
			},
			whereCondition: {
				state: sandbox.state,
				desiredState: SandboxDesiredState.STARTED,
			},
			runtimeIntent: { lifecycle: SandboxLifecycle.STOPPED },
		});
		this.committedEvents.publish(
			SandboxEvents.STOPPED,
			new SandboxStoppedEvent(stopped, force)
		);
		return stopped;
	}

	private async withdrawStart(sandbox: Sandbox): Promise<Sandbox | null> {
		if (!startOriginDesiredState(sandbox)) return null;
		const withdrawn = await this.startWaits.withdraw(sandbox);
		if (!withdrawn) throw new StateChangeInProgressException();
		return withdrawn;
	}
}

function assertSandboxNotErrored(sandbox: Sandbox): void {
	if (sandbox.isErrored()) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.ERRORED,
				'The sandbox is in an error state. Recover it, or delete it and create a new one.'
			)
		);
	}
}

function assertSandboxStartable(sandbox: Sandbox): void {
	if (sandbox.abuseHold) {
		throw new SandboxAbuseHoldException();
	}
	assertSandboxNotErrored(sandbox);

	if (
		String(sandbox.state) !== String(sandbox.desiredState) &&
		(sandbox.desiredState !== SandboxDesiredState.ARCHIVED ||
			(sandbox.state !== SandboxState.STOPPED &&
				sandbox.state !== SandboxState.ARCHIVING))
	) {
		throw new StateChangeInProgressException();
	}

	if (!STARTABLE_STATES.includes(sandbox.state)) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.STATE_INVALID,
				'The sandbox cannot be started in its current state. Wait for it to stop or archive, then start it.'
			)
		);
	}

	if (sandbox.pending) {
		throw new StateChangeInProgressException();
	}
}
