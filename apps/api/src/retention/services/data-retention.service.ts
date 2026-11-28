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
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Session } from '../../auth/entities/session.entity';
import { BillingProfile } from '../../billing/entities/billing-profile.entity';
import { RETENTION_POLICY } from '../../common/constants/retention-policy.constants';
import {
	type BatchedPruneTarget,
	type BatchedUpdateTarget,
	pruneInBatches,
	updateInBatches,
} from '../../infra/database/utils/batched-prune.util';
import { MachineSession } from '../../machine/entities/machine-session.entity';
import { Job } from '../../machine-job/entities/job.entity';
import { JobProjectionStatus } from '../../machine-job/enums/job-projection-status.enum';
import { JobStatus } from '../../machine-job/enums/job-status.enum';
import { UNMET_DEMAND } from '../../marketplace/constants/marketplace.constants';
import { UnmetDemand } from '../../marketplace/entities/unmet-demand.entity';
import { EdgeSession } from '../../networking/entities/edge-session.entity';
import { RealtimeOutboxStatus } from '../../notification/constants/realtime-outbox.constants';
import { RealtimeOutboxEvent } from '../../notification/entities/realtime-outbox-event.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SshAccess } from '../../sandbox/entities/ssh-access.entity';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { DATA_RETENTION } from '../constants/data-retention.constants';

type RetentionTarget = Pick<
	BatchedPruneTarget<object>,
	'entity' | 'where' | 'bindings'
> & { label: string };

const olderThanDays = (column: string): string =>
	`${column} < transaction_timestamp() - (? * interval '1 day')`;

const RETENTION_TARGETS: readonly RetentionTarget[] = [
	{
		label: 'audit logs',
		entity: AuditLog,
		where: olderThanDays('target."createdAt"'),
		bindings: [RETENTION_POLICY.auditLogDays],
	},
	{
		label: 'published outbox events',
		entity: RealtimeOutboxEvent,
		where: `target.status = ? AND ${olderThanDays('target."publishedAt"')}`,
		bindings: [
			RealtimeOutboxStatus.PUBLISHED,
			DATA_RETENTION.PUBLISHED_OUTBOX_DAYS,
		],
	},
	{
		label: 'failed outbox events',
		entity: RealtimeOutboxEvent,
		where: `target.status = ? AND ${olderThanDays('target."updatedAt"')}`,
		bindings: [RealtimeOutboxStatus.FAILED, DATA_RETENTION.FAILED_OUTBOX_DAYS],
	},
	{
		label: 'finished machine jobs',
		entity: Job,
		where: `target.status IN (?, ?) AND target."projectionStatus" IN (?, ?)
			AND ${olderThanDays('target."completedAt"')}
			AND NOT EXISTS (SELECT 1 FROM machine_qualification_challenge challenge WHERE challenge."jobId" = target.id)
			AND NOT EXISTS (SELECT 1 FROM machine_reliability_event event WHERE event."jobId" = target.id)`,
		bindings: [
			JobStatus.COMPLETED,
			JobStatus.FAILED,
			JobProjectionStatus.NOT_REQUIRED,
			JobProjectionStatus.APPLIED,
			DATA_RETENTION.FINISHED_MACHINE_JOB_DAYS,
		],
	},
	{
		label: 'expired sign-in sessions',
		entity: Session,
		where: olderThanDays('target."expiresAt"'),
		bindings: [DATA_RETENTION.EXPIRED_SESSION_DAYS],
	},
	{
		label: 'ended machine sessions',
		entity: MachineSession,
		where: `${olderThanDays('COALESCE(target."revokedAt", target."expiresAt")')}
			AND NOT EXISTS (SELECT 1 FROM machine_usage_receipt receipt WHERE receipt."sessionId" = target.id)
			AND NOT EXISTS (SELECT 1 FROM secret_delivery_event delivery WHERE delivery."machineSessionId" = target.id)
			AND NOT EXISTS (SELECT 1 FROM machine_observation observation WHERE observation."sessionId" = target.id)`,
		bindings: [DATA_RETENTION.ENDED_MACHINE_SESSION_DAYS],
	},
	{
		label: 'ended edge sessions',
		entity: EdgeSession,
		where: olderThanDays('COALESCE(target."revokedAt", target."expiresAt")'),
		bindings: [DATA_RETENTION.ENDED_EDGE_SESSION_DAYS],
	},
	{
		label: 'billing profiles of deleted organizations',
		entity: BillingProfile,
		where: `EXISTS (SELECT 1 FROM organization
			WHERE organization.id = target."organizationId"
			  AND ${olderThanDays('organization."deletedAt"')})`,
		bindings: [DATA_RETENTION.DELETED_ORGANIZATION_BILLING_PROFILE_DAYS],
	},
	{
		label: 'unmet demand records',
		entity: UnmetDemand,
		where: olderThanDays('target."createdAt"'),
		bindings: [UNMET_DEMAND.RETENTION_DAYS],
	},
	{
		label: 'expired SSH access',
		entity: SshAccess,
		where: 'target."expiresAt" < LOCALTIMESTAMP',
		bindings: [],
	},
];

const DESTROYED_SANDBOX_SCRUB: Pick<
	BatchedUpdateTarget<Sandbox>,
	'entity' | 'where' | 'bindings' | 'assignments'
> = {
	entity: Sandbox,
	where: `target.state = ? AND (target.env <> '{}'::jsonb OR target."runtimeSpec" IS NOT NULL)`,
	bindings: [SandboxState.DESTROYED],
	assignments: `env = '{}'::jsonb, "runtimeSpec" = NULL`,
};

@Injectable()
export class DataRetentionService {
	private readonly logger = new Logger(DataRetentionService.name);

	constructor(private readonly entityManager: EntityManager) {}

	async prune(): Promise<void> {
		for (const { label, ...target } of RETENTION_TARGETS) {
			const deleted = await pruneInBatches(this.entityManager.fork(), {
				...target,
				batchSize: DATA_RETENTION.BATCH_SIZE,
				maximumBatches: DATA_RETENTION.MAXIMUM_BATCHES,
			});
			if (deleted > 0) this.logger.log(`Pruned ${deleted} ${label}`);
		}
		const scrubbed = await updateInBatches(this.entityManager.fork(), {
			...DESTROYED_SANDBOX_SCRUB,
			batchSize: DATA_RETENTION.BATCH_SIZE,
			maximumBatches: DATA_RETENTION.MAXIMUM_BATCHES,
		});
		if (scrubbed > 0) {
			this.logger.log(`Scrubbed ${scrubbed} destroyed sandboxes`);
		}
	}
}
