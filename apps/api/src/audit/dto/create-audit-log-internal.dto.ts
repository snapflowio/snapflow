/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	AuditActorType,
	AuditCredentialType,
} from '../constants/audit-principal.constants';
import { AuditLogMetadata } from '../entities/audit-log.entity';
import { AuditAction } from '../enums/audit-action.enum';
import { AuditTarget } from '../enums/audit-target.enum';

export class CreateAuditLogInternalDto {
	actorId: string;
	actorType: AuditActorType;
	actorDisplayName?: string;
	actorEmail?: string;
	credentialType: AuditCredentialType;
	credentialId?: string;
	organizationId?: string;
	userId?: string;
	action: AuditAction;
	targetType?: AuditTarget;
	targetId?: string;
	statusCode?: number;
	errorMessage?: string;
	ipAddress?: string;
	userAgent?: string;
	source?: string;
	metadata?: AuditLogMetadata;
}
