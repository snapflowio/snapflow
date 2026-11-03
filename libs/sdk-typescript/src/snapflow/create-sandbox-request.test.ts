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

import {
	Continent,
	GpuType,
	MachineCategory,
	MachineTier,
	PlacementKind,
	SandboxMode,
} from '@snapflow/api-client';
import {
	toCreateSandboxRequest,
	toPlacementRequest,
	toSandboxQuoteRequest,
} from './create-sandbox-request.js';

const MACHINE_ID = '6f1c3e9a-2b4d-4c8e-9f0a-1b2c3d4e5f60';
const PRICE_CARD_ID = '0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d';
const MAX_HOURLY_PRICE_MICRO_USD = '250000';
const MAX_EGRESS_MICRO_USD_PER_GIB = '50000';
const GERMANY = 'DE';

describe('placement mapping', () => {
	it('maps a pinned placement to the pinned machine and accepted price card', () => {
		expect(
			toPlacementRequest({
				machineId: MACHINE_ID,
				expectedPriceCardId: PRICE_CARD_ID,
			})
		).toEqual({
			kind: PlacementKind.Pinned,
			machineId: MACHINE_ID,
			expectedPriceCardId: PRICE_CARD_ID,
		});
	});

	it('maps a flexible placement to its constraints', () => {
		expect(
			toPlacementRequest({
				category: MachineCategory.Gpu,
				locations: [GERMANY, Continent.Europe],
				ownMachinesOnly: true,
				minimumTier: MachineTier.Verified,
				maxHourlyPriceMicroUsd: MAX_HOURLY_PRICE_MICRO_USD,
				maxEgressMicroUsdPerGiB: MAX_EGRESS_MICRO_USD_PER_GIB,
			})
		).toEqual({
			kind: PlacementKind.Flexible,
			category: MachineCategory.Gpu,
			locations: [GERMANY, Continent.Europe],
			ownMachinesOnly: true,
			minimumTier: MachineTier.Verified,
			maxHourlyPriceMicroUsd: MAX_HOURLY_PRICE_MICRO_USD,
			maxEgressMicroUsdPerGiB: MAX_EGRESS_MICRO_USD_PER_GIB,
		});
	});

	it('leaves the location to automatic placement by default', () => {
		const request = toPlacementRequest(undefined);

		expect(request.kind).toBe(PlacementKind.Flexible);
		expect(request.locations).toBeUndefined();
		expect(request.ownMachinesOnly).toBeUndefined();
	});

	it('sends a pinned placement when creating a sandbox', () => {
		const request = toCreateSandboxRequest(
			{
				mode: SandboxMode.Ephemeral,
				image: 'ubuntu:24.04',
				placement: { machineId: MACHINE_ID },
				resources: { cpu: 2, gpuType: GpuType.H100 },
			},
			{},
			undefined
		);

		expect(request.placement).toEqual({
			kind: PlacementKind.Pinned,
			machineId: MACHINE_ID,
		});
		expect(request.gpuType).toEqual([GpuType.H100]);
	});

	it('builds a quote request from the placement and resources', () => {
		expect(
			toSandboxQuoteRequest({
				placement: { locations: [Continent.NorthAmerica] },
				resources: { cpu: 4, memory: 8, disk: 40 },
			})
		).toEqual({
			placement: {
				kind: PlacementKind.Flexible,
				locations: [Continent.NorthAmerica],
			},
			cpu: 4,
			memory: 8,
			disk: 40,
		});
	});
});
