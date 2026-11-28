/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { type CreateSandbox, GpuType } from '@snapflow/api-client';
import { SdkErrorCode } from '../errors/error-catalog.js';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import type { Resources } from '../snapflow.types.js';

export type ResourceRequest = Pick<
	CreateSandbox,
	'cpu' | 'memory' | 'disk' | 'gpu' | 'gpuType'
>;

type ResourceSize = 'cpu' | 'memory' | 'disk';

const MINIMUM_RESOURCE_SIZE = 1;
const MAXIMUM_GPUS_PER_SANDBOX = 1;
const GPU_TYPES: readonly string[] = Object.values(GpuType);

const RESOURCE_SIZE_UNITS: Readonly<Record<ResourceSize, string>> = {
	cpu: 'vCPUs',
	memory: 'GiB of memory',
	disk: 'GiB of disk',
};

function invalidResources(message: string): SnapflowValidationError {
	return new SnapflowValidationError(
		message,
		undefined,
		undefined,
		SdkErrorCode.RESOURCES_INVALID
	);
}

function assertResourceSize(name: ResourceSize, value: number | undefined) {
	if (value === undefined) return;
	if (Number.isInteger(value) && value >= MINIMUM_RESOURCE_SIZE) return;
	throw invalidResources(
		`resources.${name} must be a whole number of at least ${MINIMUM_RESOURCE_SIZE} (${RESOURCE_SIZE_UNITS[name]}), but it is ${value}. Omit it to use the snapshot's value.`
	);
}

function assertGpuCount(gpu: number | undefined) {
	if (gpu === undefined) return;
	if (Number.isInteger(gpu) && gpu >= 0 && gpu <= MAXIMUM_GPUS_PER_SANDBOX) {
		return;
	}
	throw invalidResources(
		`resources.gpu must be a whole number from 0 to ${MAXIMUM_GPUS_PER_SANDBOX}, but it is ${gpu}. A sandbox can use at most ${MAXIMUM_GPUS_PER_SANDBOX} GPU.`
	);
}

function gpuTypePreferences(
	gpuType: Resources['gpuType']
): ResourceRequest['gpuType'] {
	if (gpuType === undefined) return undefined;
	const preferences = Array.isArray(gpuType) ? gpuType : [gpuType];
	if (preferences.length === 0) {
		throw invalidResources(
			'resources.gpuType must list at least one GPU type. Omit it to accept any GPU type.'
		);
	}
	const unknown = preferences.filter((type) => !GPU_TYPES.includes(type));
	if (unknown.length > 0) {
		throw invalidResources(
			`resources.gpuType must name GPU types from: ${GPU_TYPES.join(', ')}, but it includes ${unknown.join(', ')}.`
		);
	}
	return preferences;
}

export function toResourceRequest(
	resources: Resources | undefined
): ResourceRequest {
	if (resources === undefined) return {};
	const { gpuType, ...sizes } = resources;
	assertResourceSize('cpu', sizes.cpu);
	assertResourceSize('memory', sizes.memory);
	assertResourceSize('disk', sizes.disk);
	assertGpuCount(sizes.gpu);
	return { ...sizes, gpuType: gpuTypePreferences(gpuType) };
}
