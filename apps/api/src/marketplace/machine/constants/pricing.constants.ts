/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BasisPoints } from '../../../common/values/basis-points.value';
import { ResourceShape } from '../../../common/values/resource-shape.value';
import { MachineCategory } from '../enums/machine-category.enum';

export const HOURS_PER_BILLING_MONTH = 730n;

export const BYTES_PER_GIBIBYTE = 1_073_741_824n;

export const EGRESS_PRICE_CLASS = 'egress';

export const REFERENCE_SHAPES: Readonly<
	Record<MachineCategory, ResourceShape>
> = {
	[MachineCategory.GENERAL]: ResourceShape.of({
		cpu: 2,
		memoryGiB: 4,
		diskGiB: 20,
		gpu: 0,
	}),
	[MachineCategory.HIGH_MEMORY]: ResourceShape.of({
		cpu: 2,
		memoryGiB: 16,
		diskGiB: 20,
		gpu: 0,
	}),
	[MachineCategory.GPU]: ResourceShape.of({
		cpu: 8,
		memoryGiB: 64,
		diskGiB: 200,
		gpu: 1,
	}),
};

export const HIGH_MEMORY_GIB_PER_VCPU = 8;

export const MINIMUM_RELIABILITY_FOR_RANKING = BasisPoints.of(5_000);
