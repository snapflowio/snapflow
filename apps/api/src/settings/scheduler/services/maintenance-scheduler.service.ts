/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { OnEvent } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
	SCHEDULED_JOB_METADATA,
	type ScheduledJobMetadata,
} from '../../../common/constants/scheduled-job.constants';
import { SettingsEvents } from '../../constants/settings.constants';
import { SettingsService } from '../../services/settings.service';

@Injectable()
export class MaintenanceSchedulerService implements OnApplicationBootstrap {
	private readonly logger = new Logger(MaintenanceSchedulerService.name);
	private maintenanceExemptJobs: ReadonlySet<string> = new Set();

	constructor(
		private readonly registry: SchedulerRegistry,
		private readonly settings: SettingsService,
		private readonly discovery: DiscoveryService,
		private readonly scanner: MetadataScanner,
		private readonly reflector: Reflector
	) {}

	onApplicationBootstrap(): Promise<void> {
		this.maintenanceExemptJobs = this.discoverMaintenanceExemptJobs();
		return this.reconcile();
	}

	@OnEvent(SettingsEvents.CHANGED)
	async onSettingsChanged(): Promise<void> {
		try {
			await this.reconcile();
		} catch (error) {
			this.logger.error('Could not apply the maintenance mode', error);
		}
	}

	private discoverMaintenanceExemptJobs(): ReadonlySet<string> {
		const names = this.discovery
			.getProviders()
			.flatMap(({ instance }) => {
				if (typeof instance !== 'object' || instance === null) return [];
				const prototype: object = Object.getPrototypeOf(instance);
				return this.scanner
					.getAllMethodNames(prototype)
					.map((method) =>
						this.reflector.get<ScheduledJobMetadata | undefined>(
							SCHEDULED_JOB_METADATA,
							Reflect.get(prototype, method)
						)
					);
			})
			.flatMap((metadata) =>
				metadata?.maintenanceExempt && metadata.name ? [metadata.name] : []
			);
		return new Set(names);
	}

	private async reconcile(): Promise<void> {
		const { maintenanceMode } = await this.settings.get();
		const changing = [...this.registry.getCronJobs()]
			.map(([name, job]) => ({
				job,
				run: this.maintenanceExemptJobs.has(name) || !maintenanceMode,
			}))
			.filter(({ job, run }) => job.isActive !== run);
		const started = changing.filter(({ run }) => run);
		const stopped = changing.filter(({ run }) => !run);
		for (const { job } of started) job.start();
		for (const { job } of stopped) job.stop();
		if (started.length > 0) {
			this.logger.log(`${started.length} scheduled jobs running`);
		}
		if (stopped.length > 0) {
			this.logger.log(
				`${stopped.length} scheduled jobs paused for maintenance mode`
			);
		}
	}
}
