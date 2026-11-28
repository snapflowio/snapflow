/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	computeHourMicroUsd,
	customerPriceMicroUsd,
	type HostRates,
	type MachineSpec,
	machineShape,
} from './host-rates.ts';

export interface PriceSplit {
	renterPaysMicroUsd: string;
	feeMicroUsd: string;
	youGetMicroUsd: string;
}

export function priceSplit(
	hostHourMicroUsd: bigint,
	markupBasisPoints: number
): PriceSplit {
	const renterPays = customerPriceMicroUsd(hostHourMicroUsd, markupBasisPoints);
	return {
		renterPaysMicroUsd: renterPays.toString(),
		feeMicroUsd: (renterPays - hostHourMicroUsd).toString(),
		youGetMicroUsd: hostHourMicroUsd.toString(),
	};
}

export function wholeMachinePriceSplit(
	rates: HostRates,
	spec: MachineSpec,
	markupBasisPoints: number
): PriceSplit {
	return priceSplit(
		computeHourMicroUsd(rates, machineShape(spec)),
		markupBasisPoints
	);
}
