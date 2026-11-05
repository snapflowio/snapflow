/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DecimalType } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { NetworkUsagePeriod } from '../../../networking/usage/entities/network-usage-period.entity';
import type { MachineUsageReceiptEnvelope } from '../../../usage/schemas/machine-usage-envelope.schema';
import { SandboxPlacement } from '../../entities/sandbox-placement.entity';
import {
	MACHINE_USAGE_COLUMN_LENGTH,
	MACHINE_USAGE_NUMERIC_PRECISION,
	MachineUsageRuntimeState,
} from '../constants/machine-usage.constants';
import { Machine } from './machine.entity';
import { MachineSession } from './machine-session.entity';

const NETWORK_BYTES_COLUMNS = [
	'internetEgressBytes',
	'internetIngressBytes',
	'hostEgressBytes',
	'hostIngressBytes',
	'tapEgressBytes',
	'tapIngressBytes',
	'acceptedInternetEgressDeltaBytes',
	'acceptedInternetIngressDeltaBytes',
	'clampedInternetEgressBytes',
	'clampedInternetIngressBytes',
	'hostEgressDeltaBytes',
	'hostIngressDeltaBytes',
] as const;

const networkBytesColumn = (
	fieldName: (typeof NETWORK_BYTES_COLUMNS)[number]
) =>
	({
		type: DecimalType,
		columnType: `numeric(${MACHINE_USAGE_NUMERIC_PRECISION.NETWORK_BYTES},0)`,
		runtimeType: 'string',
		fieldName,
	}) as const;

@Entity({ tableName: 'machine_usage_receipt' })
@Index({
	name: 'IDX_machine_usage_receipt_digest',
	expression:
		'create unique index "IDX_machine_usage_receipt_digest" on "machine_usage_receipt" ("payloadDigest")',
})
@Index({
	name: 'IDX_machine_usage_receipt_sequence',
	expression:
		'create unique index "IDX_machine_usage_receipt_sequence" on "machine_usage_receipt" ("machineId", "placementId", "generationId", "sequence")',
})
@Index({
	name: 'IDX_machine_usage_receipt_chain',
	expression:
		'create unique index "IDX_machine_usage_receipt_chain" on "machine_usage_receipt" ("placementId", "generationId", "previousDigest")',
})
@Index({
	name: 'IDX_machine_usage_receipt_placement_time',
	properties: ['placementId', 'sampledAt'],
})
@Index({
	name: 'IDX_machine_usage_receipt_unrated_network',
	expression:
		'create index "IDX_machine_usage_receipt_unrated_network" on "machine_usage_receipt" ("receivedAt") where "networkPeriodId" is null',
})
@Index({
	name: 'IDX_machine_usage_receipt_network_period',
	properties: ['networkPeriodId'],
})
@Index({
	name: 'IDX_machine_usage_receipt_predecessor',
	properties: ['predecessorId', 'placementId'],
})
@Check({
	name: 'CHK_machine_usage_receipt_generation',
	expression: '"assignmentGeneration" > 0',
})
@Check({
	name: 'CHK_machine_usage_receipt_resources',
	expression: 'cpu >= 0 and "memoryGiB" >= 0 and "diskGiB" >= 0 and gpu >= 0',
})
@Check({
	name: 'CHK_machine_usage_receipt_counters',
	expression:
		'"sequence" > 0 and "runningMillis" >= 0 and "acceptedComputeDeltaMillis" >= 0 and "acceptedStorageDeltaMillis" >= 0',
})
@Check({
	name: 'CHK_machine_usage_receipt_network',
	expression: NETWORK_BYTES_COLUMNS.map((column) => `"${column}" >= 0`).join(
		' and '
	),
})
@Check({
	name: 'CHK_machine_usage_receipt_interval',
	expression: '"sampledAt" >= "intervalStartAt"',
})
export class MachineUsageReceipt {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_usage_receipt_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => MachineSession,
		mapToPk: true,
		joinColumn: 'sessionId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_usage_receipt_session',
	})
	sessionId: string;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumn: 'placementId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_usage_receipt_placement',
	})
	placementId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'sandboxId',
	})
	sandboxId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'fencingToken',
	})
	fencingToken: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'generationId',
	})
	generationId: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${MACHINE_USAGE_NUMERIC_PRECISION.COUNTER},0)`,
		runtimeType: 'string',
	})
	sequence: string;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_USAGE_COLUMN_LENGTH.PAYLOAD_DIGEST})`,
		fieldName: 'previousDigest',
	})
	previousDigest: string;

	@ManyToOne({
		entity: () => MachineUsageReceipt,
		mapToPk: true,
		joinColumn: 'predecessorId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_usage_receipt_predecessor',
	})
	predecessorId: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'sampledAt',
	})
	sampledAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'intervalStartAt',
	})
	intervalStartAt: Date;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'intervalStartState',
	})
	intervalStartState: MachineUsageRuntimeState;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	state: MachineUsageRuntimeState;

	@Property({
		type: DecimalType,
		columnType: `numeric(${MACHINE_USAGE_NUMERIC_PRECISION.COUNTER},0)`,
		runtimeType: 'string',
		fieldName: 'runningMillis',
	})
	runningMillis: string;

	@Property(networkBytesColumn('internetEgressBytes'))
	internetEgressBytes: string;

	@Property(networkBytesColumn('internetIngressBytes'))
	internetIngressBytes: string;

	@Property(networkBytesColumn('hostEgressBytes'))
	hostEgressBytes: string;

	@Property(networkBytesColumn('hostIngressBytes'))
	hostIngressBytes: string;

	@Property(networkBytesColumn('tapEgressBytes'))
	tapEgressBytes: string;

	@Property(networkBytesColumn('tapIngressBytes'))
	tapIngressBytes: string;

	@Property(networkBytesColumn('acceptedInternetEgressDeltaBytes'))
	acceptedInternetEgressDeltaBytes: string;

	@Property(networkBytesColumn('acceptedInternetIngressDeltaBytes'))
	acceptedInternetIngressDeltaBytes: string;

	@Property(networkBytesColumn('clampedInternetEgressBytes'))
	clampedInternetEgressBytes: string;

	@Property(networkBytesColumn('clampedInternetIngressBytes'))
	clampedInternetIngressBytes: string;

	@Property(networkBytesColumn('hostEgressDeltaBytes'))
	hostEgressDeltaBytes: string;

	@Property(networkBytesColumn('hostIngressDeltaBytes'))
	hostIngressDeltaBytes: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
	})
	cpu: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'memoryGiB',
	})
	memoryGiB: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'diskGiB',
	})
	diskGiB: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
	})
	gpu: number;

	@Property({
		type: DecimalType,
		columnType: `numeric(${MACHINE_USAGE_NUMERIC_PRECISION.COUNTER},0)`,
		runtimeType: 'string',
		fieldName: 'acceptedComputeDeltaMillis',
	})
	acceptedComputeDeltaMillis: string;

	@Property({
		type: DecimalType,
		columnType: `numeric(${MACHINE_USAGE_NUMERIC_PRECISION.COUNTER},0)`,
		runtimeType: 'string',
		fieldName: 'acceptedStorageDeltaMillis',
	})
	acceptedStorageDeltaMillis: string;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_USAGE_COLUMN_LENGTH.PAYLOAD_DIGEST})`,
		fieldName: 'payloadDigest',
	})
	payloadDigest: string;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_USAGE_COLUMN_LENGTH.SIGNATURE})`,
	})
	signature: string;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'signerPublicKey',
	})
	signerPublicKey: string;

	@Property({
		type: 'json',
		columnType: 'jsonb',
	})
	envelope: MachineUsageReceiptEnvelope;

	@ManyToOne({
		entity: () => NetworkUsagePeriod,
		mapToPk: true,
		joinColumn: 'networkPeriodId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_usage_receipt_network_period',
	})
	networkPeriodId: string | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'receivedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	receivedAt: Date;
}
