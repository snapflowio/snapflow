/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException } from '@nestjs/common';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { GPU_PRICE_CLASS_PREFIX } from '../constants/marketplace.constants';
import { MachineCategory } from '../enums/machine-category.enum';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import type { MachinePriceClassFacts } from '../types/machine.types';

function gpuPriceClass(gpuType: GpuType): string {
	return `${GPU_PRICE_CLASS_PREFIX}${gpuType}`;
}

const GPU_PRICE_CLASSES: ReadonlySet<string> = new Set(
	Object.values(GpuType).map(gpuPriceClass)
);

export const PRICE_CLASSES: readonly string[] = [
	MachineCategory.GENERAL,
	MachineCategory.HIGH_MEMORY,
	...GPU_PRICE_CLASSES,
];

export function priceClassOf(machine: MachinePriceClassFacts): string | null {
	if (machine.category === null) return null;
	if (machine.category !== MachineCategory.GPU) return machine.category;
	if (machine.gpuType === null) {
		throw new Error('A GPU machine needs a measured GPU type');
	}
	return gpuPriceClass(machine.gpuType);
}

export function priceClassCategory(priceClass: string): MachineCategory | null {
	if (priceClass === MachineCategory.GENERAL) return MachineCategory.GENERAL;
	if (priceClass === MachineCategory.HIGH_MEMORY) {
		return MachineCategory.HIGH_MEMORY;
	}
	return GPU_PRICE_CLASSES.has(priceClass) ? MachineCategory.GPU : null;
}

export interface MachinePriceClass {
	priceClass: string;
	category: MachineCategory;
}

export function requirePriceClass(
	machine: MachinePriceClassFacts
): MachinePriceClass {
	const priceClass = priceClassOf(machine);
	if (priceClass === null || machine.category === null) {
		throw new ConflictException({
			code: MarketplaceErrorCode.MACHINE_NOT_BENCHMARKED,
			message: 'The machine has no passed benchmark yet',
		});
	}
	return { priceClass, category: machine.category };
}
