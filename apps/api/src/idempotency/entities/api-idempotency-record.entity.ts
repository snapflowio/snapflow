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
} from '@mikro-orm/decorators/legacy';
import {
	PLATFORM_PRINCIPAL_TYPE,
	type PlatformPrincipalType,
} from '../../common/types/platform-principal.types';
import {
	IDEMPOTENCY_LIMITS,
	IDEMPOTENCY_STATE,
	type IdempotencyState,
} from '../constants/idempotency.constants';

export interface IdempotencyTerminalProblem {
	code: string;
	detail: string;
	status: number;
}

const idempotencyPrincipalTypes = Object.values(PLATFORM_PRINCIPAL_TYPE)
	.map((principalType) => `'${principalType}'`)
	.join(', ');
const idempotencyStates = Object.values(IDEMPOTENCY_STATE)
	.map((state) => `'${state}'`)
	.join(', ');

@Entity({ tableName: 'api_idempotency_record' })
@Index({
	name: 'UQ_api_idempotency_request',
	expression:
		'create unique index "UQ_api_idempotency_request" on "api_idempotency_record" ("organizationId", "principalType", "principalId", "method", "routeTemplate", "keyDigest")',
})
@Index({
	name: 'IDX_api_idempotency_expiry',
	properties: ['expiresAt'],
})
@Check({
	name: 'CHK_api_idempotency_response_storage',
	expression:
		'not ("responseBody" is not null and "sensitiveResponseEnvelope" is not null)',
})
@Check({
	name: 'CHK_api_idempotency_completed_response',
	expression: `state <> '${IDEMPOTENCY_STATE.COMPLETED}' or ("responseStatus" is not null and "completedAt" is not null)`,
})
@Check({
	name: 'CHK_api_idempotency_terminal_problem',
	expression: `state <> '${IDEMPOTENCY_STATE.FAILED_TERMINAL}' or ("terminalProblem" is not null and "completedAt" is not null)`,
})
@Check({
	name: 'CHK_api_idempotency_principal_type',
	expression: `"principalType" in (${idempotencyPrincipalTypes})`,
})
@Check({
	name: 'CHK_api_idempotency_state',
	expression: `state in (${idempotencyStates})`,
})
export class ApiIdempotencyRecord {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'organizationId',
	})
	organizationId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'principalType',
	})
	principalType: PlatformPrincipalType;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'principalId',
	})
	principalId: string;

	@Property({
		type: 'string',
		columnType: `varchar(${IDEMPOTENCY_LIMITS.METHOD_MAX_LENGTH})`,
	})
	method: string;

	@Property({
		type: 'string',
		columnType: `varchar(${IDEMPOTENCY_LIMITS.ROUTE_TEMPLATE_MAX_LENGTH})`,
		fieldName: 'routeTemplate',
	})
	routeTemplate: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'keyDigest',
	})
	keyDigest: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'requestFingerprint',
	})
	requestFingerprint: string;

	@Property({
		type: 'smallint',
		columnType: 'smallint',
		fieldName: 'fingerprintSchemaVersion',
	})
	fingerprintSchemaVersion: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	state: IdempotencyState;

	@Property({
		type: 'string',
		columnType: `varchar(${IDEMPOTENCY_LIMITS.RESOURCE_TYPE_MAX_LENGTH})`,
		fieldName: 'resourceType',
		nullable: true,
	})
	resourceType: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'resourceId',
		nullable: true,
	})
	resourceId: string | null;

	@Property({
		type: 'smallint',
		columnType: 'smallint',
		fieldName: 'responseStatus',
		nullable: true,
	})
	responseStatus: number | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'responseHeaders',
		nullable: true,
	})
	responseHeaders: Record<string, string> | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'responseBody',
		nullable: true,
	})
	responseBody: unknown | null;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'sensitiveResponseEnvelope',
		nullable: true,
	})
	sensitiveResponseEnvelope: string | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'terminalProblem',
		nullable: true,
	})
	terminalProblem: IdempotencyTerminalProblem | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'completedAt',
		nullable: true,
	})
	completedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'expiresAt',
	})
	expiresAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}
