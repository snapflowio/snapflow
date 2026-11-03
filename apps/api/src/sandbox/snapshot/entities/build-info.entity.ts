/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { Collection } from '@mikro-orm/core';
import {
	BeforeCreate,
	Entity,
	OneToMany,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { SimpleArrayTextType } from '../../../common/types/simple-array-text.types';
import { Sandbox } from '../../instance/entities/sandbox.entity';
import { Snapshot } from './snapshot.entity';

export const BUILD_INFO_REFERENCE_PREFIX = 'snapflow-';
const BUILD_INFO_REFERENCE_SUFFIX = ':snapflow';
const BUILD_INFO_HASH_ALGORITHM = 'sha256';

export function generateBuildInfoHash(
	dockerfileContent: string,
	contextHashes: string[] = []
): string {
	const sortedContextHashes = [...contextHashes].sort();
	const combined = dockerfileContent + sortedContextHashes.join('');
	const hash = createHash(BUILD_INFO_HASH_ALGORITHM)
		.update(combined)
		.digest('hex');
	return `${BUILD_INFO_REFERENCE_PREFIX}${hash}${BUILD_INFO_REFERENCE_SUFFIX}`;
}

@Entity({ tableName: 'build_info' })
export class BuildInfo {
	@PrimaryKey({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'snapshotRef',
	})
	snapshotRef: string;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'dockerfileContent',
		nullable: true,
	})
	dockerfileContent?: string | null;

	@Property({
		type: SimpleArrayTextType,
		columnType: 'text',
		fieldName: 'contextHashes',
		nullable: true,
	})
	contextHashes?: string[] | null;

	@OneToMany({
		entity: () => Snapshot,
		mappedBy: 'buildInfo',
	})
	snapshots = new Collection<Snapshot>(this);

	@OneToMany({
		entity: () => Sandbox,
		mappedBy: 'buildInfo',
	})
	sandboxes = new Collection<Sandbox>(this);

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastUsedAt',
		defaultRaw: 'CURRENT_TIMESTAMP',
	})
	lastUsedAt: Date;

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

	@BeforeCreate()
	generateHash(): void {
		if (!this.dockerfileContent) {
			throw new Error('BuildInfo requires Dockerfile content before insertion');
		}
		this.snapshotRef = generateBuildInfoHash(
			this.dockerfileContent,
			this.contextHashes ?? []
		);
	}
}
