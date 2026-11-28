/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import type {
	AuditActorType,
	AuditCredentialType,
} from '../constants/audit-principal.constants';
import type { AuditLog, AuditLogMetadata } from '../entities/audit-log.entity';

@ApiSchema({ name: 'AuditLog' })
export class AuditLogDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	actorId: string;

	@ApiProperty()
	actorType: AuditActorType;

	@ApiPropertyOptional()
	actorDisplayName?: string;

	@ApiPropertyOptional()
	actorEmail?: string;

	@ApiProperty()
	credentialType: AuditCredentialType;

	@ApiPropertyOptional()
	credentialId?: string;

	@ApiPropertyOptional()
	organizationId?: string;

	@ApiPropertyOptional()
	userId?: string;

	@ApiProperty()
	action: string;

	@ApiPropertyOptional()
	targetType?: string;

	@ApiPropertyOptional()
	targetId?: string;

	@ApiPropertyOptional()
	statusCode?: number;

	@ApiPropertyOptional()
	errorMessage?: string;

	@ApiPropertyOptional()
	ipAddress?: string;

	@ApiPropertyOptional()
	userAgent?: string;

	@ApiPropertyOptional()
	source?: string;

	@ApiPropertyOptional({
		type: 'object',
		additionalProperties: true,
	})
	metadata?: AuditLogMetadata;

	@ApiProperty()
	createdAt: Date;

	static from(auditLog: AuditLog): AuditLogDto {
		return {
			id: auditLog.id,
			actorId: auditLog.actorId,
			actorType: auditLog.actorType,
			actorDisplayName: auditLog.actorDisplayName ?? undefined,
			actorEmail: auditLog.actorEmail ?? undefined,
			credentialType: auditLog.credentialType,
			credentialId: auditLog.credentialId ?? undefined,
			organizationId: auditLog.organizationId ?? undefined,
			userId: auditLog.userId ?? undefined,
			action: auditLog.action,
			targetType: auditLog.targetType ?? undefined,
			targetId: auditLog.targetId ?? undefined,
			statusCode: auditLog.statusCode ?? undefined,
			errorMessage: auditLog.errorMessage ?? undefined,
			ipAddress: auditLog.ipAddress ?? undefined,
			userAgent: auditLog.userAgent ?? undefined,
			source: auditLog.source ?? undefined,
			metadata: auditLog.metadata ?? undefined,
			createdAt: auditLog.createdAt,
		};
	}
}
