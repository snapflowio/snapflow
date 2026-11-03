/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BigIntType } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { EDGE_STATUS, type EdgeStatus } from '../constants/edge.constants';
import {
	NETWORKING_LIMITS,
	type NetworkProtocol,
} from '../constants/networking.constants';
import { NETWORKING_DATABASE_CHECK } from '../constants/networking-database-check.constants';
import type {
	EdgeCapacityProfile,
	EdgeCapacitySnapshot,
	EdgePortInventory,
	EdgePublicAddress,
	EdgeTunnelAddress,
} from '../types/networking.types';

@Entity({ tableName: 'network_edge' })
@Check({
	name: 'CHK_network_edge_credential_generation',
	expression: '"credentialGeneration" > 0',
})
@Check({
	name: 'CHK_network_edge_session_generation',
	expression: '"sessionGeneration" >= 0',
})
@Check({
	name: 'CHK_network_edge_usage_epoch',
	expression: '"usageEpoch" >= 0',
})
@Check({
	name: 'CHK_network_edge_route_publication',
	expression:
		'("routeTablePublishedVersion" is null) = ("routeTablePublishedDigest" is null)',
})
@Check({
	name: 'CHK_network_edge_status',
	expression: NETWORKING_DATABASE_CHECK.edgeStatus,
})
@Check({
	name: 'CHK_network_edge_supported_protocols',
	expression: NETWORKING_DATABASE_CHECK.edgeProtocols,
})
@Unique({
	name: 'UQ_network_edge_name',
	properties: ['name'],
})
@Index({
	name: 'IDX_network_edge_status',
	properties: ['status'],
})
@Index({
	name: 'IDX_network_edge_created',
	properties: ['createdAt', 'id'],
})
@Index({
	name: 'IDX_network_edge_control_refresh',
	expression:
		'create index "IDX_network_edge_control_refresh" on "network_edge" ("routeTableGeneratedAt", "id") where "sessionExpiresAt" is not null',
})
@Unique({
	name: 'IDX_network_edge_identity_key',
	properties: ['identityKeyId'],
	where: '"identityKeyId" is not null',
})
export class Edge {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumNameLength})`,
	})
	name: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		default: EDGE_STATUS.ENROLLING,
	})
	status: EdgeStatus;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'identityPublicKey',
		nullable: true,
	})
	identityPublicKey: string | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumIdentityKeyIdLength})`,
		fieldName: 'identityKeyId',
		nullable: true,
	})
	identityKeyId: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'identityKeyRegisteredAt',
		nullable: true,
	})
	identityKeyRegisteredAt: Date | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.sha256HexLength})`,
		fieldName: 'enrollmentSecretHash',
		nullable: true,
	})
	enrollmentSecretHash: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'enrollmentSecretExpiresAt',
		nullable: true,
	})
	enrollmentSecretExpiresAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'enrollmentCompletedAt',
		nullable: true,
	})
	enrollmentCompletedAt: Date | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'credentialGeneration',
		default: 1,
	})
	credentialGeneration: number;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumHostnameLength})`,
		fieldName: 'publicHost',
	})
	publicHost: string;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'tunnelAddress',
	})
	tunnelAddress: EdgeTunnelAddress;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'publicAddresses',
	})
	publicAddresses: EdgePublicAddress[];

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'portInventory',
	})
	portInventory: EdgePortInventory;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'capacityProfile',
	})
	capacityProfile: EdgeCapacityProfile;

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		fieldName: 'supportedProtocols',
	})
	supportedProtocols: NetworkProtocol[];

	@Property({
		type: new BigIntType('string'),
		columnType: 'bigint',
		fieldName: 'routeTableVersion',
		defaultRaw: '0',
	})
	routeTableVersion: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'routeTableGeneratedAt',
		defaultRaw: 'CURRENT_TIMESTAMP',
	})
	routeTableGeneratedAt: Date;

	@Property({
		type: new BigIntType('string'),
		columnType: 'bigint',
		fieldName: 'routeTablePublishedVersion',
		nullable: true,
	})
	routeTablePublishedVersion: string | null;

	@Property({
		type: 'string',
		columnType: 'char(64)',
		fieldName: 'routeTablePublishedDigest',
		nullable: true,
	})
	routeTablePublishedDigest: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'sessionGeneration',
		default: 0,
	})
	sessionGeneration: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'usageEpoch',
		default: 0,
	})
	usageEpoch: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'sessionExpiresAt',
		nullable: true,
	})
	sessionExpiresAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastHeartbeatAt',
		nullable: true,
	})
	lastHeartbeatAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastStartedAt',
		nullable: true,
	})
	lastStartedAt: Date | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumVersionLength})`,
		fieldName: 'lastReportedVersion',
		nullable: true,
	})
	lastReportedVersion: string | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumVersionLength})`,
		fieldName: 'lastReportedRouteTableVersion',
		nullable: true,
	})
	lastReportedRouteTableVersion: string | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'observedCapacity',
		nullable: true,
	})
	observedCapacity: EdgeCapacitySnapshot | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastFailureAt',
		nullable: true,
	})
	lastFailureAt: Date | null;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumErrorLength})`,
		fieldName: 'lastFailureReason',
		nullable: true,
	})
	lastFailureReason: string | null;

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
