/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import type { CursorPage } from '../../../common/dto/cursor-page.dto';
import { AccessDeniedException } from '../../../common/exceptions/access-denied.exception';
import type { HumanPrincipal } from '../../../common/types/platform-principal.types';
import { apiError } from '../../../common/utils/error/api-error.util';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import { findCursorPage } from '../../../common/utils/pagination/cursor-page.util';
import { ResourceShape } from '../../../common/values/resource-shape.value';
import { MachineService } from '../../../machine/services/machine.service';
import { runtimeIntentUpdate } from '../../../machine/utils/proto/sandbox-runtime-intent.util';
import { OrganizationService } from '../../../organization/services/organization.service';
import { OrganizationLimitsService } from '../../../organization/services/organization-limits.service';
import {
	MachineReservationService,
	type ReservedMachine,
} from '../../../placement/services/machine-reservation.service';
import {
	type PendingQuotaUsage,
	pendingQuotaUsage,
	sandboxQuotaUsage,
} from '../../../placement/utils/pending-quota-usage.util';
import { placementRequest } from '../../../placement/utils/sandbox-placement.util';
import { SecretService } from '../../../secrets/services/secret.service';
import { ForkSandboxDto } from '../../dto/fork-sandbox.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxFork } from '../../entities/sandbox-fork.entity';
import { SandboxClass } from '../../enums/sandbox-class.enum';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import { SandboxPlacementErrorCode } from '../../enums/sandbox-placement-error-code.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { StateChangeInProgressException } from '../../exceptions/state-change-in-progress.exception';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { isEphemeral } from '../../utils/runtime/ephemeral.util';
import { buildForkedSandbox } from '../../utils/sandbox-fork.util';
import { assertSandboxCopyAllowed } from '../../utils/state/abuse-hold.util';
import { SandboxAdmissionService } from '../admission/sandbox-admission.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { SandboxQuotaService } from '../sandbox/sandbox-quota.service';
import { SandboxRuntimeSpecService } from '../sandbox/sandbox-runtime-spec.service';
import { SandboxCreateNotifier } from './sandbox-create-notifier.service';

const MAXIMUM_FORK_ANCESTORS = 50;

function forkSourceMachineId(
	sourceSandbox: Sandbox,
	hasManagedSecrets: boolean
): string {
	assertSandboxCopyAllowed(sourceSandbox);
	const requiredSourceState = hasManagedSecrets
		? SandboxState.STOPPED
		: SandboxState.STARTED;
	if (sourceSandbox.state !== requiredSourceState) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.STATE_INVALID,
				hasManagedSecrets
					? 'A sandbox with managed secrets must be stopped before it is forked. Stop the sandbox, then fork it.'
					: 'Only a started sandbox can be forked. Start the sandbox, then fork it.'
			)
		);
	}
	if (sourceSandbox.pending) {
		throw new StateChangeInProgressException();
	}
	if (!sourceSandbox.machineId) {
		throw new NotFoundException(
			apiError(
				SandboxErrorCode.NOT_PLACED,
				`Sandbox ${sourceSandbox.id} is not placed on a machine. Start the sandbox, then try again.`
			)
		);
	}
	if (sourceSandbox.gpu > 0) {
		throw new UnprocessableEntityException(
			apiError(
				SandboxErrorCode.FORK_NOT_SUPPORTED,
				'GPU sandboxes cannot be forked. Create a new sandbox from a snapshot instead.'
			)
		);
	}
	return sourceSandbox.machineId;
}

@Injectable()
export class SandboxForkService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxService: SandboxService,
		private readonly sandboxRepository: SandboxRepository,
		private readonly machineService: MachineService,
		private readonly machineReservations: MachineReservationService,
		private readonly organizationLimitsService: OrganizationLimitsService,
		private readonly organizations: OrganizationService,
		private readonly secretService: SecretService,
		private readonly quota: SandboxQuotaService,
		private readonly runtimeSpecs: SandboxRuntimeSpecService,
		private readonly admission: SandboxAdmissionService,
		private readonly createNotifier: SandboxCreateNotifier
	) {}

	async forkSandbox(
		sandboxIdOrName: string,
		organizationId: string,
		dto: ForkSandboxDto,
		principal: HumanPrincipal,
		managedSecretUseAuthorized: boolean
	): Promise<Sandbox> {
		const sourceSandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		const hasManagedSecrets = await this.secretService.hasSandboxBindings(
			organizationId,
			sourceSandbox.id
		);
		if (hasManagedSecrets && !managedSecretUseAuthorized) {
			throw new AccessDeniedException();
		}

		if (sourceSandbox.sandboxClass !== SandboxClass.LINUX_VM) {
			throw new UnprocessableEntityException(
				apiError(
					SandboxErrorCode.FORK_NOT_SUPPORTED,
					'This sandbox class cannot be forked. Create a new sandbox from a snapshot instead.'
				)
			);
		}

		let pending: PendingQuotaUsage = {};
		try {
			const machineId = forkSourceMachineId(sourceSandbox, hasManagedSecrets);
			const machine = await this.machineService.findOneOrFail(machineId);
			const forkedSandbox = buildForkedSandbox(
				sourceSandbox,
				organizationId,
				dto.name
			);

			await this.organizations.assertActive(organizationId);
			const ownMachinesOnly = machine.organizationId === organizationId;
			await this.admission.assertPaymentsSignable(
				forkedSandbox,
				ownMachinesOnly
			);
			const usage = sandboxQuotaUsage(forkedSandbox);
			const reservation = await this.quota.validateOrganizationQuotas({
				organizationLimits:
					await this.organizationLimitsService.get(organizationId),
				sandboxClass: forkedSandbox.sandboxClass,
				usage,
				ephemeral: isEphemeral(forkedSandbox),
				ownMachinesOnly,
			});
			pending = pendingQuotaUsage(reservation, usage);

			Object.assign(
				forkedSandbox,
				runtimeIntentUpdate(
					forkedSandbox,
					await this.runtimeSpecs.forkIntent(forkedSandbox, sourceSandbox.id)
				)
			);

			const insertedForkedSandbox = await this.insertFork(
				sourceSandbox,
				forkedSandbox,
				machine.id,
				principal
			);

			this.createNotifier.notifyCreated(insertedForkedSandbox);

			return insertedForkedSandbox;
		} catch (error) {
			await this.quota.rollbackPendingUsage(
				organizationId,
				sourceSandbox.sandboxClass,
				pending.cpu,
				pending.memory,
				pending.disk,
				pending.gpu
			);

			if (isUniqueViolation(error)) {
				throw new ConflictException(
					apiError(
						SandboxErrorCode.NAME_TAKEN,
						'A sandbox with this name already exists. Choose another name for the fork.'
					)
				);
			}

			throw error;
		}
	}

	private insertFork(
		sourceSandbox: Sandbox,
		forkedSandbox: Sandbox,
		machineId: string,
		principal: HumanPrincipal
	): Promise<Sandbox> {
		return this.entityManager.transactional(
			async () => {
				await this.sandboxRepository.updateWhere(sourceSandbox.id, {
					updateData: {
						state: SandboxState.FORKING,
						pending: true,
					},
					whereCondition: {
						state: sourceSandbox.state,
						pending: false,
					},
				});
				return this.sandboxRepository.insertWithMachineReservation(
					forkedSandbox,
					{
						reserveMachine: (manager) =>
							this.reserveForkMachine(manager, forkedSandbox, machineId),
						parentId: sourceSandbox.id,
						persistRelated: (manager) =>
							this.secretService.copySandboxBindings(
								manager,
								forkedSandbox.organizationId,
								sourceSandbox.id,
								forkedSandbox.id,
								principal
							),
					}
				);
			},
			{ propagation: TransactionPropagation.NESTED }
		);
	}

	private async reserveForkMachine(
		manager: EntityManager,
		forkedSandbox: Sandbox,
		machineId: string
	): Promise<ReservedMachine> {
		const reservedMachine = await this.machineReservations.reserveSpecific(
			manager,
			machineId,
			{
				customerOrganizationId: forkedSandbox.organizationId,
				placement: placementRequest(forkedSandbox),
				sandboxClass: forkedSandbox.sandboxClass,
				...ResourceShape.fromSandbox(forkedSandbox),
				gpuType: forkedSandbox.gpuType ?? null,
				mode: forkedSandbox.mode,
				capabilities: forkedSandbox.capabilities,
				volumeIds: (forkedSandbox.volumes ?? []).map(
					({ volumeId }) => volumeId
				),
			}
		);
		if (!reservedMachine) {
			throw new BadRequestException(
				apiError(
					SandboxPlacementErrorCode.MACHINE_UNAVAILABLE,
					'The machine of the source sandbox is unavailable or full. Try again later.'
				)
			);
		}
		return reservedMachine;
	}

	async getForkChildren(
		organizationId: string,
		sandboxIdOrName: string,
		includeDestroyed: boolean,
		limit: number,
		cursor?: string
	): Promise<CursorPage<Sandbox>> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		const forkPage = await findCursorPage(this.entityManager, SandboxFork, {
			where: { parentId: sandbox.id },
			orderBy: { createdAt: QueryOrder.DESC, id: QueryOrder.DESC },
			limit,
			cursor,
		});
		const children = await this.entityManager.find(Sandbox, {
			id: { $in: forkPage.items.map(({ childId }) => childId) },
			organizationId,
			...(!includeDestroyed && { state: { $ne: SandboxState.DESTROYED } }),
		});
		const childById = new Map(children.map((child) => [child.id, child]));
		return {
			...forkPage,
			items: forkPage.items.flatMap((fork) => {
				const child = childById.get(fork.childId);
				return child ? [child] : [];
			}),
		};
	}

	async getForkParent(
		organizationId: string,
		sandboxIdOrName: string
	): Promise<Sandbox | null> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		const fork = await this.entityManager.findOne(SandboxFork, {
			childId: sandbox.id,
		});
		if (!fork) return null;
		return this.entityManager.findOne(Sandbox, {
			id: fork.parentId,
			organizationId,
		});
	}

	async getForkAncestors(
		organizationId: string,
		sandboxIdOrName: string
	): Promise<Sandbox[]> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		const rows = await this.entityManager.execute<
			{ id: string; depth: number }[]
		>(
			`WITH RECURSIVE ancestry AS (
				SELECT fork."parentId" AS id,
				       1 AS depth,
				       ARRAY[fork."childId", fork."parentId"]::varchar[] AS path
				FROM sandbox_fork fork
				INNER JOIN sandbox parent
					ON parent.id = fork."parentId"
					AND parent."organizationId" = ?
				WHERE fork."childId" = ?
				UNION ALL
				SELECT fork."parentId" AS id,
				       ancestry.depth + 1,
				       ancestry.path || fork."parentId"
				FROM ancestry
				INNER JOIN sandbox_fork fork ON fork."childId" = ancestry.id
				INNER JOIN sandbox parent
					ON parent.id = fork."parentId"
					AND parent."organizationId" = ?
				WHERE ancestry.depth < ?
				  AND NOT fork."parentId" = ANY(ancestry.path)
			)
			SELECT id, depth FROM ancestry ORDER BY depth DESC`,
			[organizationId, sandbox.id, organizationId, MAXIMUM_FORK_ANCESTORS]
		);
		if (rows.length === 0) return [];
		const ancestors = await this.entityManager.find(Sandbox, {
			id: { $in: rows.map(({ id }) => id) },
			organizationId,
		});
		const ancestorById = new Map(
			ancestors.map((ancestor) => [ancestor.id, ancestor])
		);
		return rows.flatMap(({ id }) => {
			const ancestor = ancestorById.get(id);
			return ancestor ? [ancestor] : [];
		});
	}
}
