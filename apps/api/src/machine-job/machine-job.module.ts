/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DockerRegistryModule } from '../docker-registry/docker-registry.module';
import { ControlWakeModule } from '../infra/control-wake/control-wake.module';
import { MachineModule } from '../machine/machine.module';
import { ObjectStorageModule } from '../object-storage/object-storage.module';
import { JobController } from './controllers/job.controller';
import { Job } from './entities/job.entity';
import { JobLeaseExpiryManager } from './managers/job-lease-expiry.manager';
import { JobService } from './services/job.service';
import { JobCompletionService } from './services/job-completion.service';
import { JobLeaseService } from './services/job-lease.service';
import { JobPollService } from './services/job-poll.service';
import { JobProjectionService } from './services/job-projection.service';
import { JobStateHandlerService } from './services/job-state-handler.service';
import { MachineJobDispatchService } from './services/machine-job-dispatch.service';

@Module({
	imports: [
		DockerRegistryModule,
		MikroOrmModule.forFeature([Job]),
		ControlWakeModule,
		DiscoveryModule,
		ObjectStorageModule,
		MachineModule,
	],
	controllers: [JobController],
	providers: [
		JobCompletionService,
		JobLeaseExpiryManager,
		JobLeaseService,
		JobPollService,
		JobProjectionService,
		JobService,
		JobStateHandlerService,
		MachineJobDispatchService,
	],
	exports: [
		JobLeaseExpiryManager,
		JobProjectionService,
		JobService,
		MachineJobDispatchService,
	],
})
export class MachineJobModule {}
