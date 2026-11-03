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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrganizationService } from '../../../../organization/tenant/services/organization.service';
import { OrganizationLimitsService } from '../../../../organization/tenant/services/organization-limits.service';
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
import type {
	MoveSandboxDto,
	StartSandboxDto,
} from '../../dto/sandbox-placement.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxArchivedEvent } from '../../events/sandbox-archived.event';
import { SandboxDestroyedEvent } from '../../events/sandbox-destroyed.event';
import { SandboxStartedEvent } from '../../events/sandbox-started.event';
import { SandboxStoppedEvent } from '../../events/sandbox-stopped.event';
import { StateChangeInProgressException } from '../../exceptions/state-change-in-progress.exception';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import {
	deletesImmediatelyOnStop,
	isEphemeral,
} from '../../utils/runtime/ephemeral.util';
import { SandboxService } from '../sandbox/sandbox.service';
import { SandboxQuotaService } from '../sandbox/sandbox-quota.service';

const STARTABLE_STATES: readonly SandboxState[] = [
	SandboxState.STOPPED,
	SandboxState.ARCHIVED,
	SandboxState.ARCHIVING,
	SandboxState.PAUSED,
];

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
		private readonly eventEmitter: EventEmitter2
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
			throw new BadRequestException('Sandbox is not stopped');
		}

		if (sandbox.pending) {
			throw new StateChangeInProgressException();
		}

		if (isEphemeral(sandbox)) {
			throw new BadRequestException('Ephemeral sandboxes cannot be archived');
		}

		const updatedSandbox = await this.sandboxRepository.updateWhere(
			sandbox.id,
			{
				updateData: {
					state: SandboxState.ARCHIVING,
					desiredState: SandboxDesiredState.ARCHIVED,
				},
				whereCondition: { pending: false, state: SandboxState.STOPPED },
			}
		);

		this.eventEmitter.emit(
			SandboxEvents.ARCHIVED,
			new SandboxArchivedEvent(updatedSandbox)
		);
		return updatedSandbox;
	}

	async destroy(
		sandboxIdOrName: string,
		organizationId: string
	): Promise<Sandbox> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);

		if (sandbox.pending && sandbox.state !== SandboxState.PENDING_BUILD) {
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
				'Cannot delete sandbox which has active fork children. The forks must be deleted first.'
			);
		}

		const updatedSandbox = await this.sandboxRepository.updateWhere(
			sandbox.id,
			{
				updateData: Sandbox.getSoftDeleteUpdate(sandbox),
				whereCondition: { pending: sandbox.pending, state: sandbox.state },
			}
		);

		this.eventEmitter.emit(
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

			const usage = sandboxQuotaUsage(sandbox);
			const reservation = await this.quota.validateOrganizationQuotas({
				organizationLimits:
					await this.organizationLimitsService.get(organizationId),
				sandboxClass: sandbox.sandboxClass,
				usage,
				ephemeral: isEphemeral(sandbox),
				ownMachinesOnly: await this.placements.runsOnOwnMachines(sandbox),
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
					},
					whereCondition: { pending: false, state: sandbox.state },
				}
			);

			this.eventEmitter.emit(
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

		assertSandboxNotErrored(sandbox);

		if (String(sandbox.state) !== String(sandbox.desiredState)) {
			throw new StateChangeInProgressException();
		}

		if (
			sandbox.state !== SandboxState.STARTED &&
			sandbox.state !== SandboxState.PAUSED
		) {
			throw new BadRequestException('Sandbox is not in a stoppable state');
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
					: { pending: true, desiredState: SandboxDesiredState.STOPPED },
				whereCondition: { pending: false, state: sandbox.state },
			}
		);

		if (deleteOnStop) {
			this.eventEmitter.emit(
				SandboxEvents.DESTROYED,
				new SandboxDestroyedEvent(updatedSandbox)
			);
		} else {
			this.eventEmitter.emit(
				SandboxEvents.STOPPED,
				new SandboxStoppedEvent(updatedSandbox, force)
			);
		}

		return updatedSandbox;
	}
}

function assertSandboxNotErrored(sandbox: Sandbox): void {
	if (sandbox.isErrored()) {
		throw new BadRequestException('Sandbox is in an errored state');
	}
}

function assertSandboxStartable(sandbox: Sandbox): void {
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
		throw new BadRequestException('Sandbox is not in valid state');
	}

	if (sandbox.pending) {
		throw new StateChangeInProgressException();
	}
}
