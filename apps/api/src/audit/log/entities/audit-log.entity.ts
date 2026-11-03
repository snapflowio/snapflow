/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Check,
	Entity,
	Index,
	PrimaryKey,
	Property,
	Trigger,
} from '@mikro-orm/decorators/legacy';
import { v4 } from 'uuid';
import {
	AUDIT_ACTOR_TYPE,
	AUDIT_CREDENTIAL_TYPE,
	type AuditActorType,
	type AuditCredentialType,
} from '../constants/audit-principal.constants';

export type AuditLogMetadata = Record<string, unknown>;

const auditActorTypes = Object.values(AUDIT_ACTOR_TYPE)
	.map((actorType) => `'${actorType}'`)
	.join(', ');

const auditCredentialTypes = Object.values(AUDIT_CREDENTIAL_TYPE)
	.map((credentialType) => `'${credentialType}'`)
	.join(', ');

@Trigger({
	name: 'audit_log_immutable',
	timing: 'before',
	events: ['update'],
	body: `
		if OLD."statusCode" is not null then
			raise exception 'Finalized audit logs are immutable.'
				using errcode = 'integrity_constraint_violation';
		end if;

		return NEW;
	`,
})
@Entity({ tableName: 'audit_log' })
@Index({
	name: 'audit_log_createdAt_index',
	properties: ['createdAt', 'id'],
})
@Index({
	name: 'audit_log_organizationId_createdAt_index',
	properties: ['organizationId', 'createdAt', 'id'],
})
@Index({
	name: 'IDX_audit_log_dangling',
	properties: ['createdAt', 'id'],
	where: '"statusCode" is null',
})
@Check({
	name: 'CHK_audit_log_actor_type',
	expression: `"actorType" in (${auditActorTypes})`,
})
@Check({
	name: 'CHK_audit_log_credential_type',
	expression: `"credentialType" in (${auditCredentialTypes})`,
})
export class AuditLog {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'actorId',
	})
	actorId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'actorType',
	})
	actorType: AuditActorType;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'actorDisplayName',
		nullable: true,
	})
	actorDisplayName: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'actorEmail',
		nullable: true,
	})
	actorEmail: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'credentialType',
	})
	credentialType: AuditCredentialType;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'credentialId',
		nullable: true,
	})
	credentialId: string | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'organizationId',
		nullable: true,
	})
	organizationId: string | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'userId',
		nullable: true,
	})
	userId: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	action: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'targetType',
		nullable: true,
	})
	targetType: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'targetId',
		nullable: true,
	})
	targetId: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'statusCode',
		nullable: true,
	})
	statusCode: number | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'errorMessage',
		nullable: true,
	})
	errorMessage: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'ipAddress',
		nullable: true,
	})
	ipAddress: string | null;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'userAgent',
		nullable: true,
	})
	userAgent: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		nullable: true,
	})
	source: string | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		nullable: true,
	})
	metadata: AuditLogMetadata | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	constructor(params?: {
		id?: string;
		actorId: string;
		actorType: AuditActorType;
		actorDisplayName?: string;
		actorEmail?: string;
		credentialType: AuditCredentialType;
		credentialId?: string;
		organizationId?: string;
		userId?: string;
		action: string;
		targetType?: string;
		targetId?: string;
		statusCode?: number;
		errorMessage?: string;
		ipAddress?: string;
		userAgent?: string;
		source?: string;
		metadata?: AuditLogMetadata;
		createdAt?: Date;
	}) {
		if (!params) return;

		this.id = params.id ?? v4();
		this.actorId = params.actorId;
		this.actorType = params.actorType;
		this.actorDisplayName = orNull(params.actorDisplayName);
		this.actorEmail = orNull(params.actorEmail);
		this.credentialType = params.credentialType;
		this.credentialId = orNull(params.credentialId);
		this.organizationId = orNull(params.organizationId);
		this.userId = orNull(params.userId);
		this.action = params.action;
		this.targetType = orNull(params.targetType);
		this.targetId = orNull(params.targetId);
		this.statusCode = orNull(params.statusCode);
		this.errorMessage = orNull(params.errorMessage);
		this.ipAddress = orNull(params.ipAddress);
		this.userAgent = orNull(params.userAgent);
		this.source = orNull(params.source);
		this.metadata = orNull(params.metadata);
		this.createdAt = params.createdAt ?? new Date();
	}
}

function orNull<Value>(value: Value | undefined): Value | null {
	return value ?? null;
}
