/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ceilDivide,
	decimalScale,
	parseFixed,
} from '../../../common/utils/fixed-point.util';
import type { ResourceShapeFields } from '../../../common/values/resource-shape.value';
import { USAGE_RESOURCE_SCALE } from '../../../usage/constants/usage-accounting.constants';
import type { ComputeRates, PricedCapacity } from '../../types/pricing.types';

const RESOURCE_FACTOR = decimalScale(USAGE_RESOURCE_SCALE);

export function scaledResource(value: number, name: string): bigint {
	if (!Number.isFinite(value) || value < 0) {
		throw new Error(`${name} must be a nonnegative finite number`);
	}
	return parseFixed(
		value.toFixed(USAGE_RESOURCE_SCALE),
		USAGE_RESOURCE_SCALE,
		name
	);
}

export function shapeFits(
	capacity: PricedCapacity,
	shape: ResourceShapeFields
): boolean {
	return (
		shape.cpu <= capacity.vcpu &&
		shape.memoryGiB <= capacity.memoryGib &&
		shape.gpu <= capacity.gpuCount
	);
}

export function sliceHourMicroUsd(
	card: ComputeRates & PricedCapacity,
	shape: ResourceShapeFields
): bigint {
	if (!shapeFits(card, shape)) {
		throw new Error('The shape does not fit the machine');
	}
	return ceilDivide(
		BigInt(card.vcpuHourMicroUsd) * scaledResource(shape.cpu, 'vCPU') +
			BigInt(card.memoryGibHourMicroUsd) *
				scaledResource(shape.memoryGiB, 'memory') +
			BigInt(card.gpuHourMicroUsd) * scaledResource(shape.gpu, 'GPU'),
		RESOURCE_FACTOR
	);
}

export function wholeMachineShape(
	capacity: PricedCapacity,
	diskGiB: number
): ResourceShapeFields {
	return {
		cpu: capacity.vcpu,
		memoryGiB: capacity.memoryGib,
		diskGiB,
		gpu: capacity.gpuCount,
	};
}

export function machineHourMicroUsd(
	card: ComputeRates & PricedCapacity
): bigint {
	return sliceHourMicroUsd(card, wholeMachineShape(card, 0));
}
