/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Machine } from '../../../machine/entities/machine.entity';
import { largestGuestMemoryGiB } from '../../../machine/utils/machine-memory.util';
import { MARKETPLACE_INITIAL_VERSION } from '../../constants/marketplace.constants';
import type { PricedCapacity } from '../../types/pricing.types';

export function nextPriceCardVersion(latestVersion: number | null): number {
	return latestVersion === null
		? MARKETPLACE_INITIAL_VERSION
		: latestVersion + 1;
}

export function pricedCapacity(
	machine: Pick<
		Machine,
		| 'measuredVcpu'
		| 'cpu'
		| 'measuredMemoryGib'
		| 'allocatableMemoryMiB'
		| 'vmMemoryOverheadMiB'
		| 'gpuCount'
	>
): PricedCapacity {
	return {
		vcpu: machine.measuredVcpu ?? machine.cpu,
		memoryGib: Math.floor(
			machine.measuredMemoryGib ?? largestGuestMemoryGiB(machine)
		),
		gpuCount: machine.gpuCount,
	};
}

export function sameCapacity(
	card: PricedCapacity,
	capacity: PricedCapacity
): boolean {
	return (
		card.vcpu === capacity.vcpu &&
		card.memoryGib === capacity.memoryGib &&
		card.gpuCount === capacity.gpuCount
	);
}
