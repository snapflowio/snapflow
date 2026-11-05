/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
	EntityManager,
	type EntityRepository,
	MikroORM,
} from '@mikro-orm/postgresql';
import {
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { RETENTION_POLICY } from '../../common/constants/retention-policy.constants';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import { errorMessage, errorStack } from '../../common/utils/error/error.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { createRangeFilter } from '../../common/utils/pagination/range-filter.util';
import { addDays, addMilliseconds } from '../../common/utils/time.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import {
	AUDIT_JOB_LOCK,
	AUDIT_PERSISTENCE,
} from '../constants/audit-persistence.constants';
import { CreateAuditLogInternalDto } from '../dto/create-audit-log-internal.dto';
import { UpdateAuditLogInternalDto } from '../dto/update-audit-log-internal.dto';
import { AuditLog } from '../entities/audit-log.entity';
import type { AuditLogFilter } from '../types/audit-filter.types';

@Injectable()
export class AuditService {
	private readonly logger = new Logger(AuditService.name);

	constructor(
		@InjectRepository(AuditLog)
		private readonly auditLogRepository: EntityRepository<AuditLog>,
		private readonly entityManager: EntityManager,
		private readonly orm: MikroORM,
		private readonly configService: TypedConfigService,
		private readonly redisLockProvider: RedisLockProvider
	) {}

	async createLog(createDto: CreateAuditLogInternalDto): Promise<AuditLog> {
		const auditLog = new AuditLog(createDto);
		this.entityManager.persist(auditLog);
		await this.entityManager.flush();
		return auditLog;
	}

	async createCompletedLog(
		createDto: CreateAuditLogInternalDto & { statusCode: number }
	): Promise<void> {
		const auditLog = new AuditLog(createDto);
		await this.entityManager.fork().persist(auditLog).flush();
		if (this.configService.get('audit.consoleLogEnabled')) {
			this.logger.log(`AUDIT_ENTRY: ${JSON.stringify(auditLog)}`);
		}
	}

	async updateLog(
		id: string,
		updateDto: UpdateAuditLogInternalDto
	): Promise<AuditLog> {
		const auditLog = await this.auditLogRepository.findOne({ id });
		if (!auditLog) {
			throw new NotFoundException(`Audit log with ID ${id} not found`);
		}
		if (auditLog.statusCode !== null) {
			throw new ForbiddenException('Finalized audit logs are immutable.');
		}

		if (updateDto.statusCode) {
			auditLog.statusCode = updateDto.statusCode;
		}

		if (updateDto.errorMessage) {
			auditLog.errorMessage = updateDto.errorMessage;
		}

		if (updateDto.targetId) {
			auditLog.targetId = updateDto.targetId;
		}

		if (updateDto.organizationId) {
			auditLog.organizationId = updateDto.organizationId;
		}

		if (updateDto.metadata) {
			auditLog.metadata = { ...auditLog.metadata, ...updateDto.metadata };
		}

		if (this.configService.get('audit.consoleLogEnabled')) {
			this.logger.log(`AUDIT_ENTRY: ${JSON.stringify(auditLog)}`);
		}

		await this.entityManager.flush();
		return auditLog;
	}

	getAllLogs(
		limit: number,
		filters?: AuditLogFilter,
		cursor?: string
	): Promise<CursorPage<AuditLog>> {
		return this.findLogs(undefined, limit, filters, cursor);
	}

	getOrganizationLogs(
		organizationId: string,
		limit: number,
		filters?: AuditLogFilter,
		cursor?: string
	): Promise<CursorPage<AuditLog>> {
		return this.findLogs(organizationId, limit, filters, cursor);
	}

	async cleanupOldAuditLogs(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			AUDIT_JOB_LOCK.CLEANUP_KEY,
			AUDIT_JOB_LOCK.TTL_SECONDS,
			() => this.cleanupOldAuditLogsExclusively()
		);
	}

	async resolveDanglingLogs(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			AUDIT_JOB_LOCK.RESOLVE_DANGLING_KEY,
			AUDIT_JOB_LOCK.TTL_SECONDS,
			() => this.resolveDanglingLogsExclusively()
		);
	}

	@LogExecution('cleanup-old-audit-logs')
	private async cleanupOldAuditLogsExclusively(): Promise<void> {
		try {
			await RequestContext.create(this.orm.em, () =>
				this.cleanupOldAuditLogsInContext()
			);
		} catch (error) {
			this.logger.error(
				`An error occurred during cleanup of old audit logs: ${errorMessage(error)}`,
				errorStack(error)
			);
			throw error;
		}
	}

	@LogExecution('resolve-dangling-audit-logs')
	private async resolveDanglingLogsExclusively(): Promise<void> {
		await RequestContext.create(this.orm.em, () =>
			this.resolveDanglingLogsInContext()
		);
	}

	private async cleanupOldAuditLogsInContext(): Promise<void> {
		const retentionDays = RETENTION_POLICY.auditLogDays;

		const cutoffDate = addDays(
			await databaseNow(this.entityManager),
			-retentionDays
		);
		this.logger.log(
			`Starting cleanup of audit logs older than ${retentionDays} days`
		);

		const [result] = await this.entityManager.execute<{ deleted: string }[]>(
			`WITH expired AS (
				SELECT id FROM audit_log
				WHERE "createdAt" < ?
				ORDER BY "createdAt" ASC, id ASC
				LIMIT ?
			), deleted AS (
				DELETE FROM audit_log
				WHERE id = ANY(SELECT id FROM expired)
				RETURNING id
			)
			SELECT COUNT(*) AS deleted FROM deleted`,
			[cutoffDate, AUDIT_PERSISTENCE.RETENTION_DELETE_BATCH_SIZE]
		);
		const totalDeleted = Number(result?.deleted ?? 0);

		this.logger.log(
			`Completed cleanup of audit logs older than ${retentionDays} days (${totalDeleted} logs deleted)`
		);
	}

	private async resolveDanglingLogsInContext(): Promise<void> {
		const danglingBefore = addMilliseconds(
			await databaseNow(this.entityManager),
			-AUDIT_PERSISTENCE.DANGLING_LOG_AGE_MILLISECONDS
		);
		const danglingLogs = await this.auditLogRepository.find(
			{
				statusCode: null,
				createdAt: {
					$lt: danglingBefore,
				},
			},
			{
				orderBy: { createdAt: 'ASC', id: 'ASC' },
				limit: AUDIT_PERSISTENCE.DANGLING_LOG_BATCH_SIZE,
			}
		);

		for (const log of danglingLogs) {
			log.statusCode = AUDIT_PERSISTENCE.UNKNOWN_STATUS_CODE;
			if (this.configService.get('audit.consoleLogEnabled')) {
				this.logger.log(`AUDIT_ENTRY: ${JSON.stringify(log)}`);
			}
		}

		await this.entityManager.flush();
		this.logger.debug(`Resolved ${danglingLogs.length} dangling audit logs`);
	}

	private findLogs(
		organizationId: string | undefined,
		limit: number,
		filters: AuditLogFilter | undefined,
		cursor: string | undefined
	): Promise<CursorPage<AuditLog>> {
		const createdAt = createRangeFilter(filters?.from, filters?.to);
		return findCursorPage(this.entityManager, AuditLog, {
			where: {
				...(organizationId ? { organizationId } : {}),
				...(createdAt ? { createdAt } : {}),
			},
			orderBy: { createdAt: 'DESC', id: 'DESC' },
			limit,
			cursor,
		});
	}
}
