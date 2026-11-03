/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Cron, type CronOptions } from '@nestjs/schedule';
import {
	SCHEDULED_JOB_METADATA,
	type ScheduledJobMetadata,
} from '../constants/scheduled-job.constants';

type CronJobOptions = CronOptions extends infer Options
	? Options extends CronOptions
		? Omit<Options, 'disabled' | 'initialDelay'>
		: never
	: never;

type MaintenancePolicy =
	| { readonly maintenanceExempt?: false }
	| { readonly maintenanceExempt: true; readonly name: string };

type ScheduledJobOptions = CronJobOptions & MaintenancePolicy;

export function ScheduledJob(
	expression: string,
	options: ScheduledJobOptions = {}
): MethodDecorator {
	const { maintenanceExempt = false, ...cronOptions } = options;
	const metadata: ScheduledJobMetadata = {
		name: cronOptions.name,
		maintenanceExempt,
	};
	return applyDecorators(
		Cron(expression, { ...cronOptions, disabled: true }),
		SetMetadata(SCHEDULED_JOB_METADATA, metadata)
	);
}
