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
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { NETWORKING_LIMITS } from '../constants/networking.constants';
import { Edge } from './edge.entity';

@Entity({ tableName: 'network_edge_session' })
@Check({
	name: 'CHK_network_edge_session_generation',
	expression: '"generation" > 0',
})
@Check({
	name: 'CHK_network_edge_session_replacement_grace',
	expression:
		'"replacementGraceExpiresAt" is null or "replacementGraceExpiresAt" <= "expiresAt"',
})
@Unique({
	name: 'UQ_network_edge_session_generation',
	properties: ['edgeId', 'generation'],
})
@Unique({
	name: 'UQ_network_edge_session_proof_nonce',
	properties: ['edgeId', 'proofNonce'],
})
@Index({
	name: 'IDX_network_edge_session_expiry',
	properties: ['expiresAt'],
})
export class EdgeSession {
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
		deleteRule: 'cascade',
		foreignKeyName: 'FK_network_edge_session_edge',
	})
	edgeId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
	})
	generation: number;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.sha256HexLength})`,
		fieldName: 'tokenHash',
	})
	tokenHash: string;

	@Property({
		type: 'string',
		columnType: `varchar(${NETWORKING_LIMITS.maximumIdentityKeyIdLength})`,
		fieldName: 'proofNonce',
	})
	proofNonce: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'proofIssuedAt',
	})
	proofIssuedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'expiresAt',
	})
	expiresAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'replacementGraceExpiresAt',
		nullable: true,
	})
	replacementGraceExpiresAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'revokedAt',
		nullable: true,
	})
	revokedAt: Date | null;

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
