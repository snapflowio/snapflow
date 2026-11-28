/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	CreateSandbox,
	SandboxPlacementRequest,
} from '@snapflow/api-client';
import {
	type ApiFieldErrorMapping,
	type ApiFieldErrors,
	apiFieldErrors,
} from '#lib/api/errors/api-field-errors.ts';
import { CREATE_SANDBOX_STEPS } from './create-sandbox-options.ts';
import type { CreateSandboxValues } from './create-sandbox-schema.ts';

type CreateSandboxField = keyof CreateSandboxValues;
type CreateSandboxStepKey = (typeof CREATE_SANDBOX_STEPS)[number]['key'];
type CreateSandboxApiProperty =
	| keyof CreateSandbox
	| `placement.${keyof SandboxPlacementRequest}`;

const CREATE_SANDBOX_API_FIELDS: Partial<
	Record<CreateSandboxApiProperty, CreateSandboxField>
> = {
	name: 'name',
	snapshot: 'snapshot',
	buildInfo: 'image',
	cpu: 'cpu',
	memory: 'memory',
	disk: 'disk',
	gpu: 'gpu',
	gpuType: 'gpuType',
	capabilities: 'capabilities',
	mode: 'mode',
	autoStopInterval: 'autoStopInterval',
	autoArchiveInterval: 'autoArchiveInterval',
	autoDeleteInterval: 'autoDeleteInterval',
	networkBlockAll: 'networkBlockAll',
	networkAllowList: 'networkAllowList',
	domainAllowList: 'domainAllowList',
	egressBandwidthBps: 'egressBandwidthBps',
	env: 'environment',
	secretEnv: 'secretBindings',
	volumes: 'volumeMounts',
	labels: 'labels',
	placement: 'placementKind',
	'placement.kind': 'placementKind',
	'placement.machineId': 'machineId',
	'placement.category': 'placementCategory',
	'placement.locations': 'locations',
	'placement.ownMachinesOnly': 'ownMachinesOnly',
	'placement.interruptible': 'interruptible',
	'placement.wholeMachine': 'wholeMachine',
	'placement.minimumTier': 'minimumTier',
	'placement.maxHourlyPriceMicroUsd': 'maxHourlyPriceUsd',
};

const CREATE_SANDBOX_ERROR_MAPPING: ApiFieldErrorMapping<CreateSandboxField> = {
	properties: CREATE_SANDBOX_API_FIELDS,
	conflict: 'name',
};

const STEP_FIELDS: Record<CreateSandboxStepKey, readonly CreateSandboxField[]> =
	{
		workload: [
			'name',
			'source',
			'snapshot',
			'image',
			'cpu',
			'memory',
			'disk',
			'gpu',
			'gpuType',
			'capabilities',
			'placementKind',
			'machineId',
			'placementCategory',
			'locations',
			'ownMachinesOnly',
			'interruptible',
			'minimumTier',
			'maxHourlyPriceUsd',
		],
		runtime: [
			'mode',
			'autoStopInterval',
			'autoArchiveInterval',
			'autoDeleteInterval',
			'networkBlockAll',
			'networkAllowList',
			'domainAllowList',
			'egressBandwidthBps',
		],
		configuration: ['environment', 'secretBindings', 'volumeMounts', 'labels'],
		review: ['wholeMachine'],
	};

export function createSandboxFieldErrors(
	error: unknown
): ApiFieldErrors<CreateSandboxField> {
	return apiFieldErrors(error, CREATE_SANDBOX_ERROR_MAPPING);
}

export function firstStepWithErrors(
	errors: ApiFieldErrors<CreateSandboxField>
): number {
	return CREATE_SANDBOX_STEPS.findIndex((step) =>
		STEP_FIELDS[step.key].some((field) => errors[field] !== undefined)
	);
}
