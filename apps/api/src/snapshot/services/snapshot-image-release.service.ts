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
import { DockerRegistryService } from '../../docker-registry/services/docker-registry.service';
import { Snapshot } from '../entities/snapshot.entity';

@Injectable()
export class SnapshotImageReleaseService {
	private readonly logger = new Logger(SnapshotImageReleaseService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly dockerRegistryService: DockerRegistryService
	) {}

	async release(snapshot: Snapshot): Promise<void> {
		const { ref } = snapshot;
		if (!ref || ref === snapshot.imageName) return;
		const registry =
			this.dockerRegistryService.findPlatformOwnedRegistryBySnapshotRef(ref);
		if (!registry) return;
		const sharers = await this.entityManager.count(Snapshot, {
			ref,
			id: { $ne: snapshot.id },
		});
		if (sharers > 0) {
			this.logger.debug(
				`Keeping image ${ref} of snapshot ${snapshot.id}: ${sharers} other snapshots use it`
			);
			return;
		}
		await this.dockerRegistryService.deleteImageFromRegistry(ref, registry);
	}
}
