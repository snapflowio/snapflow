/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { MikroORM } from '@mikro-orm/postgresql';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitterReadinessWatcher } from '@nestjs/event-emitter';
import { DeploymentEnvironment } from '../../config/enums/deployment-environment.enum';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { DevelopmentSeedService } from '../../development/services/development-seed.service';
import { DefaultSnapshotBootstrapService } from '../../snapshot/services/default-snapshot-bootstrap.service';

@Injectable()
export class SchedulerStartupService implements OnApplicationBootstrap {
	constructor(
		readonly orm: MikroORM,
		private readonly configService: TypedConfigService,
		private readonly eventEmitterReadinessWatcher: EventEmitterReadinessWatcher,
		private readonly developmentSeed: DevelopmentSeedService,
		private readonly defaultSnapshot: DefaultSnapshotBootstrapService
	) {}

	@CreateRequestContext()
	async onApplicationBootstrap(): Promise<void> {
		await this.eventEmitterReadinessWatcher.waitUntilReady();
		if (
			this.configService.get('deployment').name ===
			DeploymentEnvironment.DEVELOPMENT
		) {
			await this.developmentSeed.apply();
		}
		this.defaultSnapshot.start();
	}
}
