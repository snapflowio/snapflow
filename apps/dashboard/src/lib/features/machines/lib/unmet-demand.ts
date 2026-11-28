/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { UnmetDemand } from '@snapflow/api-client';
import { locationCodeLabel } from '#lib/features/locations/lib/location-format.ts';
import { formatCount } from '#lib/utils/format.ts';

const GPU_PRICE_CLASS_PREFIX = 'gpu_';
const ANY_GPU = 'any';
const PRICE_CLASS_LABEL: Readonly<Record<string, string>> = {
	general: 'general-purpose machines',
	high_memory: 'high-memory machines',
};

export function priceClassLabel(priceClass: string): string {
	if (priceClass.startsWith(GPU_PRICE_CLASS_PREFIX)) {
		const gpu = priceClass.slice(GPU_PRICE_CLASS_PREFIX.length);
		return gpu === ANY_GPU ? 'GPU machines' : `${gpu.toUpperCase()} machines`;
	}
	return PRICE_CLASS_LABEL[priceClass] ?? priceClass;
}

export function unmetDemandLine(demand: UnmetDemand): string {
	const where = demand.continent
		? ` in ${locationCodeLabel(demand.continent)}`
		: '';
	const units =
		demand.gpus > 0
			? `${formatCount(demand.gpus)} GPUs`
			: `${formatCount(demand.vcpus)} vCPUs`;
	return `${formatCount(demand.requests)} requests for ${priceClassLabel(demand.priceClass)}${where} (${units})`;
}
