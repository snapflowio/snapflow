/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Injectable, Module } from '@nestjs/common';
import { DiscoveryModule, NestFactory } from '@nestjs/core';
import {
	CronExpression,
	ScheduleModule,
	SchedulerRegistry,
} from '@nestjs/schedule';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { SettingsService } from '../../services/settings.service';
import { MaintenanceSchedulerService } from './maintenance-scheduler.service';

const JOB_NAME = 'maintenance-scheduler-test-job';
const EXEMPT_JOB_NAME = 'maintenance-scheduler-test-exempt-job';

@Injectable()
class ScheduledWork {
	@ScheduledJob(CronExpression.EVERY_SECOND, { name: JOB_NAME })
	run(): void {}

	@ScheduledJob(CronExpression.EVERY_SECOND, {
		name: EXEMPT_JOB_NAME,
		maintenanceExempt: true,
	})
	runDuringMaintenance(): void {}
}

class MaintenanceSwitch {
	maintenanceMode: boolean;

	constructor(maintenanceMode: boolean) {
		this.maintenanceMode = maintenanceMode;
	}

	async get(): Promise<{ maintenanceMode: boolean }> {
		return { maintenanceMode: this.maintenanceMode };
	}
}

async function bootWith(settings: MaintenanceSwitch) {
	@Module({
		imports: [ScheduleModule.forRoot(), DiscoveryModule],
		providers: [
			MaintenanceSchedulerService,
			ScheduledWork,
			{ provide: SettingsService, useValue: settings },
		],
	})
	class SchedulerTestModule {}

	const app = await NestFactory.createApplicationContext(SchedulerTestModule, {
		logger: false,
	});
	const registry = app.get(SchedulerRegistry);
	return {
		app,
		job: registry.getCronJob(JOB_NAME),
		exemptJob: registry.getCronJob(EXEMPT_JOB_NAME),
		scheduler: app.get(MaintenanceSchedulerService),
	};
}

describe('MaintenanceSchedulerService', () => {
	it('keeps every job stopped when the process boots in maintenance mode', async () => {
		const { app, job } = await bootWith(new MaintenanceSwitch(true));
		try {
			assert.equal(job.isActive, false);
		} finally {
			await app.close();
		}
	});

	it('keeps maintenance-exempt jobs running through maintenance mode', async () => {
		const settings = new MaintenanceSwitch(true);
		const { app, exemptJob, scheduler } = await bootWith(settings);
		try {
			assert.equal(exemptJob.isActive, true);
			settings.maintenanceMode = false;
			await scheduler.onSettingsChanged();
			assert.equal(exemptJob.isActive, true);
			settings.maintenanceMode = true;
			await scheduler.onSettingsChanged();
			assert.equal(exemptJob.isActive, true);
		} finally {
			await app.close();
		}
	});

	it('starts the jobs at boot outside maintenance mode and follows later changes', async () => {
		const settings = new MaintenanceSwitch(false);
		const { app, job, scheduler } = await bootWith(settings);
		try {
			assert.equal(job.isActive, true);
			settings.maintenanceMode = true;
			await scheduler.onSettingsChanged();
			assert.equal(job.isActive, false);
			settings.maintenanceMode = false;
			await scheduler.onSettingsChanged();
			assert.equal(job.isActive, true);
		} finally {
			await app.close();
		}
	});
});
