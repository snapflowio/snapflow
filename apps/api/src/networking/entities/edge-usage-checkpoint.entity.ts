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
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { NETWORKING_LIMITS } from '../constants/networking.constants';
import type { EdgeUsageCheckpointPayload } from '../types/networking.types';
import { Edge } from './edge.entity';

@Entity({ tableName: 'edge_usage_checkpoint' })
@Check({
	name: 'CHK_edge_usage_checkpoint_sequence',
	expression: '"sequence" > 0',
})
@Check({
	name: 'CHK_edge_usage_checkpoint_usage_epoch',
	expression: '"usageEpoch" > 0',
})
@Check({
	name: 'CHK_edge_usage_checkpoint_session_generation',
	expression: '"edgeSessionGeneration" > 0',
})
@Check({
	name: 'CHK_edge_usage_checkpoint_interval',
	expression: '"intervalEndedAt" > "intervalStartedAt"',
})
@Unique({
	name: 'UQ_edge_usage_checkpoint_epoch_sequence',
	properties: ['edgeId', 'usageEpoch', 'sequence'],
})
@Unique({
	name: 'UQ_edge_usage_checkpoint_digest',
	properties: ['edgeId', 'digest'],
})
@Index({
	name: 'IDX_edge_usage_checkpoint_interval',
	properties: ['intervalEndedAt'],
})
export class EdgeUsageCheckpoint {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Edge,
		mapToPk: true,
		joinColumn: 'edgeId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		foreignKeyName: 'FK_edge_usage_checkpoint_edge',
	})
	edgeId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'usageEpoch',
	})
	usageEpoch: number;

	@Property({
		type: new BigIntType('string'),
		columnType: 'bigint',
	})
	sequence: string;

	@Property({
		type: 'string',
		columnType: `char(${NETWORKING_LIMITS.sha256HexLength})`,
		fieldName: 'previousDigest',
		nullable: true,
	})
	previousDigest: string | null;

	@Property({
		type: 'string',
		columnType: `char(${NETWORKING_LIMITS.sha256HexLength})`,
	})
	digest: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'edgeSessionGeneration',
	})
	edgeSessionGeneration: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'intervalStartedAt',
	})
	intervalStartedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'intervalEndedAt',
	})
	intervalEndedAt: Date;

	@Property({
		type: 'json',
		columnType: 'jsonb',
	})
	payload: EdgeUsageCheckpointPayload;

	@Property({
		type: 'string',
		columnType: 'text',
	})
	signature: string;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'signerPublicKey',
	})
	signerPublicKey: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'acceptedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	acceptedAt: Date;
}
