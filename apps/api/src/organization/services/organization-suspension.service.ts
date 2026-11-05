/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DEFAULT_SUSPENSION_CLEANUP_GRACE_PERIOD_HOURS } from '@snapflow/organization-access';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { OnAsyncEvent } from '../../common/decorators/on-async-event.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxDesiredState } from '../../sandbox/enums/sandbox-desired-state.enum';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { Snapshot } from '../../sandbox/snapshot/entities/snapshot.entity';
import { SnapshotState } from '../../sandbox/snapshot/enums/snapshot-state.enum';
import { UserEvents } from '../../user/constants/user-events.constants';
import { UserAuthorizationChangedEvent } from '../../user/events/user-authorization-changed.event';
import { UserBannedEvent } from '../../user/events/user-banned.event';
import { OrganizationEvents } from '../constants/organization-events.constants';
import {
	ORGANIZATION_SUSPENSION,
	ORGANIZATION_SUSPENSION_REASON,
} from '../constants/organization-suspension.constants';
import type { OrganizationSuspensionDto } from '../dto/organization-suspension.dto';
import { Organization } from '../entities/organization.entity';
import { OrganizationAuthorizationChangedEvent } from '../events/organization-authorization-changed.event';
import { OrganizationSuspendedSandboxStoppedEvent } from '../events/organization-suspended-sandbox-stopped.event';
import { OrganizationSuspendedSnapshotDeactivatedEvent } from '../events/organization-suspended-snapshot-deactivated.event';
import { OrganizationService } from './organization.service';
import { OrganizationOwnershipService } from './organization-ownership.service';

interface IdentifierRow {
	id: string;
}

const STOPPABLE_SANDBOX_FILTER = {
	desiredState: SandboxDesiredState.STARTED,
	state: { $nin: [SandboxState.ERROR, SandboxState.BUILD_FAILED] },
};

const SUSPENDED_PAST_GRACE_SQL = `organization.suspended = true
	AND organization."deletedAt" IS NULL
	AND (organization."suspendedUntil" IS NULL OR organization."suspendedUntil" > CURRENT_TIMESTAMP)
	AND organization."suspendedAt" < CURRENT_TIMESTAMP - make_interval(hours => organization."suspensionCleanupGracePeriodHours")
	AND organization."suspendedAt" > CURRENT_TIMESTAMP - make_interval(days => ?)`;

const LIFTED_SUSPENSION = {
	suspended: false,
	suspendedAt: null,
	suspendedUntil: null,
	suspensionReason: null,
} as const;

@Injectable()
export class OrganizationSuspensionService extends TrackedJobs {
	protected readonly logger = new Logger(OrganizationSuspensionService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly orm: MikroORM,
		private readonly eventEmitter: EventEmitter2,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly organizations: OrganizationService,
		private readonly ownership: OrganizationOwnershipService
	) {
		super();
	}

	async suspend(
		organizationId: string,
		suspension: OrganizationSuspensionDto
	): Promise<void> {
		await this.organizations.findOneOrFail(organizationId);
		await this.entityManager.transactional(async (manager) =>
			manager.nativeUpdate(
				Organization,
				{ id: organizationId },
				{
					suspended: true,
					suspendedAt: await databaseNow(manager),
					suspensionReason: suspension.reason ?? null,
					suspendedUntil: suspension.until ?? null,
					suspensionCleanupGracePeriodHours:
						suspension.cleanupGracePeriodHours ??
						DEFAULT_SUSPENSION_CLEANUP_GRACE_PERIOD_HOURS,
				}
			)
		);
		this.emitAuthorizationChanged(organizationId);
	}

	async unsuspend(organizationId: string): Promise<void> {
		await this.organizations.findOneOrFail(organizationId);
		await this.entityManager.transactional((manager) =>
			manager.nativeUpdate(
				Organization,
				{ id: organizationId },
				LIFTED_SUSPENSION
			)
		);
		this.emitAuthorizationChanged(organizationId);
	}

	async liftOwnerBanSuspensions(userId: string): Promise<void> {
		const organizationIds = await this.soleOwnedOrganizationIds(userId);
		if (organizationIds.length === 0) return;
		await this.entityManager.transactional((manager) =>
			manager.nativeUpdate(
				Organization,
				{
					id: { $in: organizationIds },
					suspensionReason: ORGANIZATION_SUSPENSION_REASON.OWNER_BANNED,
				},
				LIFTED_SUSPENSION
			)
		);
		for (const organizationId of organizationIds) {
			this.emitAuthorizationChanged(organizationId);
		}
	}

	@OnAsyncEvent({ event: UserEvents.BANNED })
	@TrackJobExecution()
	async handleUserBanned(event: UserBannedEvent): Promise<void> {
		this.eventEmitter.emit(
			UserEvents.AUTHORIZATION_CHANGED,
			new UserAuthorizationChangedEvent(event.userId)
		);
		const organizationIds = await this.soleOwnedOrganizationIds(event.userId);
		if (organizationIds.length === 0) return;
		await this.entityManager.transactional(async (manager) =>
			manager.nativeUpdate(
				Organization,
				{ id: { $in: organizationIds }, suspended: false },
				{
					suspended: true,
					suspendedAt: await databaseNow(manager),
					suspensionReason: ORGANIZATION_SUSPENSION_REASON.OWNER_BANNED,
					suspendedUntil: null,
					suspensionCleanupGracePeriodHours:
						DEFAULT_SUSPENSION_CLEANUP_GRACE_PERIOD_HOURS,
				}
			)
		);
		for (const organizationId of organizationIds) {
			this.emitAuthorizationChanged(organizationId);
		}
		await RequestContext.create(this.orm.em, () =>
			this.stopSandboxesOf(organizationIds)
		);
	}

	@TrackJobExecution()
	@LogExecution(ORGANIZATION_SUSPENSION.STOP_SANDBOXES_LOCK_KEY)
	async stopSuspendedOrganizationSandboxes(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			ORGANIZATION_SUSPENSION.STOP_SANDBOXES_LOCK_KEY,
			ORGANIZATION_SUSPENSION.JOB_LOCK_TTL_SECONDS,
			() =>
				RequestContext.create(this.orm.em, async () =>
					this.stopSandboxesOf(
						await this.suspendedOrganizationsWithStartedSandboxes()
					)
				)
		);
	}

	@TrackJobExecution()
	@LogExecution(ORGANIZATION_SUSPENSION.DEACTIVATE_SNAPSHOTS_LOCK_KEY)
	async deactivateSuspendedOrganizationSnapshots(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			ORGANIZATION_SUSPENSION.DEACTIVATE_SNAPSHOTS_LOCK_KEY,
			ORGANIZATION_SUSPENSION.JOB_LOCK_TTL_SECONDS,
			() =>
				RequestContext.create(this.orm.em, async () =>
					this.deactivateSnapshotsOf(
						await this.suspendedOrganizationsWithActiveSnapshots()
					)
				)
		);
	}

	private async soleOwnedOrganizationIds(userId: string): Promise<string[]> {
		return (await this.ownership.findSoleOwnedOrganizations(userId)).map(
			({ id }) => id
		);
	}

	private emitAuthorizationChanged(organizationId: string): void {
		this.eventEmitter.emit(
			OrganizationEvents.AUTHORIZATION_CHANGED,
			new OrganizationAuthorizationChangedEvent(organizationId)
		);
	}

	private async stopSandboxesOf(organizationIds: string[]): Promise<void> {
		if (organizationIds.length === 0) return;

		const sandboxes = await this.entityManager.find(
			Sandbox,
			{ organizationId: { $in: organizationIds }, ...STOPPABLE_SANDBOX_FILTER },
			{
				fields: ['id'],
				orderBy: { id: 'ASC' },
				limit: ORGANIZATION_SUSPENSION.RESOURCE_BATCH_SIZE,
			}
		);
		for (const sandbox of sandboxes) {
			await this.eventEmitter.emitAsync(
				OrganizationEvents.SUSPENDED_SANDBOX_STOPPED,
				new OrganizationSuspendedSandboxStoppedEvent(sandbox.id)
			);
		}
	}

	private async deactivateSnapshotsOf(
		organizationIds: string[]
	): Promise<void> {
		if (organizationIds.length === 0) return;

		const snapshots = await this.entityManager.find(
			Snapshot,
			{
				organizationId: { $in: organizationIds },
				state: SnapshotState.ACTIVE,
				general: false,
			},
			{
				fields: ['id'],
				limit: ORGANIZATION_SUSPENSION.RESOURCE_BATCH_SIZE,
			}
		);
		for (const snapshot of snapshots) {
			await this.eventEmitter.emitAsync(
				OrganizationEvents.SUSPENDED_SNAPSHOT_DEACTIVATED,
				new OrganizationSuspendedSnapshotDeactivatedEvent(snapshot.id)
			);
		}
	}

	private async suspendedOrganizationsWithStartedSandboxes(): Promise<
		string[]
	> {
		const rows = await this.entityManager.execute<IdentifierRow[]>(
			`SELECT organization.id
			 FROM organization
			 WHERE ${SUSPENDED_PAST_GRACE_SQL}
			   AND EXISTS (
			     SELECT 1
			     FROM sandbox
			     WHERE sandbox."organizationId" = organization.id
			       AND sandbox."desiredState" = ?::sandbox_desiredstate_enum
			       AND sandbox.state NOT IN (?::sandbox_state_enum, ?::sandbox_state_enum)
			   )
			 LIMIT ?`,
			[
				ORGANIZATION_SUSPENSION.RESOURCE_LOOKBACK_DAYS,
				SandboxDesiredState.STARTED,
				SandboxState.ERROR,
				SandboxState.BUILD_FAILED,
				ORGANIZATION_SUSPENSION.RESOURCE_BATCH_SIZE,
			]
		);
		return rows.map(({ id }) => id);
	}

	private async suspendedOrganizationsWithActiveSnapshots(): Promise<string[]> {
		const rows = await this.entityManager.execute<IdentifierRow[]>(
			`SELECT organization.id
			 FROM organization
			 WHERE ${SUSPENDED_PAST_GRACE_SQL}
			   AND EXISTS (
			     SELECT 1
			     FROM snapshot
			     WHERE snapshot."organizationId" = organization.id
			       AND snapshot.state = ?::snapshot_state_enum
			       AND snapshot.general = false
			   )
			 LIMIT ?`,
			[
				ORGANIZATION_SUSPENSION.RESOURCE_LOOKBACK_DAYS,
				SnapshotState.ACTIVE,
				ORGANIZATION_SUSPENSION.RESOURCE_BATCH_SIZE,
			]
		);
		return rows.map(({ id }) => id);
	}
}
