/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { MILLISECONDS_PER_DAY } from '../../common/constants/time.constants';
import { addMilliseconds } from '../../common/utils/time.util';
import { pruneInBatches } from '../../infra/database/utils/batched-prune.util';
import { ObjectStorageService } from '../../object-storage/services/object-storage.service';
import { BuildInfo } from '../entities/build-info.entity';
import {
	BUILD_OBJECT_KIND,
	type BuildObject,
	referencedBuildObjects,
} from '../queries/build-data.query';

const BUILD_DATA_RETENTION = {
	UNREFERENCED_OBJECT_DAYS: 7,
	UNUSED_BUILD_INFO_DAYS: 30,
	BATCH_SIZE: 500,
	MAXIMUM_BATCHES: 20,
} as const;

const BUILD_CONTEXT_KEY = /^([0-9a-f-]{36})\/([a-f0-9]{64})\/context\.tar$/;
const BUILD_LOG_KEY = /^([0-9a-f-]{36})\/build-logs\/([a-f0-9]{64})\.log$/;

const UNUSED_BUILD_INFO_SQL = `target."lastUsedAt" < transaction_timestamp() - (? * interval '1 day')
	AND NOT EXISTS (SELECT 1 FROM snapshot WHERE snapshot."buildInfoSnapshotRef" = target."snapshotRef")
	AND NOT EXISTS (SELECT 1 FROM sandbox WHERE sandbox."buildInfoSnapshotRef" = target."snapshotRef")`;

function buildObject(key: string): BuildObject | null {
	const context = BUILD_CONTEXT_KEY.exec(key);
	if (context) {
		return {
			key,
			organizationId: context[1],
			kind: BUILD_OBJECT_KIND.CONTEXT,
			hash: context[2],
		};
	}
	const log = BUILD_LOG_KEY.exec(key);
	return log
		? {
				key,
				organizationId: log[1],
				kind: BUILD_OBJECT_KIND.LOG,
				hash: log[2],
			}
		: null;
}

@Injectable()
export class BuildDataRetentionManager {
	private readonly logger = new Logger(BuildDataRetentionManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly objectStorage: ObjectStorageService
	) {}

	async prune(): Promise<void> {
		const objects = await this.pruneObjects();
		const buildInfos = await pruneInBatches(this.entityManager.fork(), {
			entity: BuildInfo,
			where: UNUSED_BUILD_INFO_SQL,
			bindings: [BUILD_DATA_RETENTION.UNUSED_BUILD_INFO_DAYS],
			batchSize: BUILD_DATA_RETENTION.BATCH_SIZE,
			maximumBatches: BUILD_DATA_RETENTION.MAXIMUM_BATCHES,
		});
		if (objects + buildInfos > 0) {
			this.logger.log(
				`Pruned ${objects} build objects and ${buildInfos} unused build definitions`
			);
		}
	}

	private async pruneObjects(): Promise<number> {
		const cutoff = addMilliseconds(
			new Date(),
			-BUILD_DATA_RETENTION.UNREFERENCED_OBJECT_DAYS * MILLISECONDS_PER_DAY
		);
		let deleted = 0;
		let continuationToken: string | undefined;
		do {
			const page = await this.objectStorage.listObjects(continuationToken);
			const candidates = page.objects.flatMap(({ key, lastModified }) => {
				const object = lastModified < cutoff ? buildObject(key) : null;
				return object ? [object] : [];
			});
			const referenced = await referencedBuildObjects(
				this.entityManager.fork(),
				candidates
			);
			const unreferenced = candidates
				.filter(({ key }) => !referenced.has(key))
				.map(({ key }) => key);
			await this.objectStorage.deleteObjects(unreferenced);
			deleted += unreferenced.length;
			continuationToken = page.continuationToken;
		} while (continuationToken);
		return deleted;
	}
}
