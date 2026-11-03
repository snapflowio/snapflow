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
	MachineUnavailableReason,
	PlacementKind,
	type SandboxQuote,
	startSandbox,
	WhenMachineUnavailable,
} from '@snapflow/api-client';
import { createApiClient } from '../snapflow/client-config.js';
import {
	SandboxPlacementErrorCode,
	SnapflowLeaseRenewalRequiredError,
	SnapflowMachineUnavailableError,
	SnapflowPriceChangedError,
} from './sandbox-placement-error.js';
import {
	SnapflowConflictError,
	SnapflowNotFoundError,
} from './snapflow-error.js';

const API_URL = 'https://api.snapflow.test';
const SDK_VERSION = '0.0.0-test';
const SANDBOX_ID = 'sandbox-id';
const HTTP_CONFLICT = 409;
const HTTP_NOT_FOUND = 404;
const MACHINE_ID = '6f1c3e9a-2b4d-4c8e-9f0a-1b2c3d4e5f60';
const PRICE_CARD_ID = '0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d';
const LEASE_ID = '3c2b1a09-8f7e-4d6c-9b5a-4f3e2d1c0b9a';
const RENEWAL_DEADLINE = '2026-10-21T12:00:00.000Z';
const ALTERNATIVE = {
	machineId: '9e8d7c6b-5a49-4382-a716-05f4e3d2c1b0',
	location: { country: 'DE', continent: Continent.Europe, city: 'Frankfurt' },
	priceCardId: PRICE_CARD_ID,
	hourlyPriceMicroUsd: '180000',
	reliabilityBasisPoints: 9900,
};
const QUOTE: SandboxQuote = {
	placementKind: PlacementKind.Pinned,
	available: true,
	eligibleMachineCount: 1,
	machineId: MACHINE_ID,
	priceCardId: PRICE_CARD_ID,
	hourlyPriceMicroUsd: '250000',
	hostHourlyMicroUsd: '200000',
	markupHourlyMicroUsd: '50000',
	markupBasisPoints: 2500,
	stoppedHourlyPriceMicroUsd: '1000',
	dailyPriceMicroUsd: '6000000',
	monthlyPriceMicroUsd: '182500000',
	minimumFundingMicroUsd: '250000',
	priceLockDays: 30,
};

function respondWith(status: number, body: Record<string, unknown>) {
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(
		new Response(JSON.stringify(body), {
			status,
			headers: { 'Content-Type': 'application/json' },
		})
	);
}

async function startRejection(): Promise<unknown> {
	const client = createApiClient(
		{ apiKey: 'api-key', apiUrl: API_URL },
		SDK_VERSION
	);
	return startSandbox({
		client,
		path: { sandboxIdOrName: SANDBOX_ID },
		body: { whenMachineUnavailable: WhenMachineUnavailable.Fail },
	}).then(
		() => undefined,
		(error: unknown) => error
	);
}

describe('sandbox placement error mapping', () => {
	afterEach(() => vi.restoreAllMocks());

	it('maps machine_unavailable to the reason and alternatives', async () => {
		respondWith(HTTP_CONFLICT, {
			code: SandboxPlacementErrorCode.MachineUnavailable,
			message: 'The pinned machine cannot take this sandbox now',
			machineId: MACHINE_ID,
			reason: MachineUnavailableReason.Full,
			alternatives: [ALTERNATIVE],
		});

		const error = await startRejection();

		expect(error).toBeInstanceOf(SnapflowMachineUnavailableError);
		expect(error).toBeInstanceOf(SnapflowConflictError);
		expect(error).toMatchObject({
			name: 'SnapflowMachineUnavailableError',
			statusCode: HTTP_CONFLICT,
			errorCode: SandboxPlacementErrorCode.MachineUnavailable,
			message: 'The pinned machine cannot take this sandbox now',
			machineId: MACHINE_ID,
			reason: MachineUnavailableReason.Full,
			alternatives: [ALTERNATIVE],
		});
	});

	it('maps machine_unavailable without alternatives to an empty list', async () => {
		respondWith(HTTP_CONFLICT, {
			code: SandboxPlacementErrorCode.MachineUnavailable,
			message: 'The machine is not offered to this organization',
			reason: MachineUnavailableReason.Paused,
		});

		const error = await startRejection();

		expect(error).toBeInstanceOf(SnapflowMachineUnavailableError);
		expect(error).toMatchObject({
			reason: MachineUnavailableReason.Paused,
			alternatives: [],
		});
	});

	it('maps price_changed to the new quote', async () => {
		respondWith(HTTP_CONFLICT, {
			code: SandboxPlacementErrorCode.PriceChanged,
			message: 'The machine price changed since it was quoted',
			quote: QUOTE,
		});

		const error = await startRejection();

		expect(error).toBeInstanceOf(SnapflowPriceChangedError);
		expect(error).toMatchObject({
			errorCode: SandboxPlacementErrorCode.PriceChanged,
			quote: QUOTE,
		});
	});

	it('maps price_changed on renewal to the current price card', async () => {
		respondWith(HTTP_CONFLICT, {
			code: SandboxPlacementErrorCode.PriceChanged,
			message: 'The machine price changed since it was quoted',
			priceCardId: PRICE_CARD_ID,
		});

		const error = await startRejection();

		expect(error).toBeInstanceOf(SnapflowPriceChangedError);
		expect(error).toMatchObject({ priceCardId: PRICE_CARD_ID });
		expect(error).toHaveProperty('quote', undefined);
	});

	it('maps lease_renewal_required to the lease and deadline', async () => {
		respondWith(HTTP_CONFLICT, {
			code: SandboxPlacementErrorCode.LeaseRenewalRequired,
			message: 'Accept the renewed price or move the sandbox to start it',
			leaseId: LEASE_ID,
			renewalDeadline: RENEWAL_DEADLINE,
		});

		const error = await startRejection();

		expect(error).toBeInstanceOf(SnapflowLeaseRenewalRequiredError);
		expect(error).toMatchObject({
			errorCode: SandboxPlacementErrorCode.LeaseRenewalRequired,
			leaseId: LEASE_ID,
			renewalDeadline: RENEWAL_DEADLINE,
		});
	});

	it('keeps other conflicts as plain conflict errors', async () => {
		respondWith(HTTP_CONFLICT, {
			message: 'Stop the sandbox before moving it',
		});

		const error = await startRejection();

		expect(error).toBeInstanceOf(SnapflowConflictError);
		expect(error).not.toBeInstanceOf(SnapflowMachineUnavailableError);
		expect(error).not.toBeInstanceOf(SnapflowPriceChangedError);
		expect(error).not.toBeInstanceOf(SnapflowLeaseRenewalRequiredError);
	});
});

describe('API error code mapping', () => {
	afterEach(() => vi.restoreAllMocks());

	it('leaves errorCode unset when the API sends only the HTTP reason phrase', async () => {
		respondWith(HTTP_NOT_FOUND, {
			statusCode: HTTP_NOT_FOUND,
			error: 'Not Found',
			message: 'Sandbox not found',
		});

		const error = await startRejection();

		expect(error).toBeInstanceOf(SnapflowNotFoundError);
		expect(error).toMatchObject({
			statusCode: HTTP_NOT_FOUND,
			message: 'Sandbox not found',
			errorCode: undefined,
		});
	});

	it('uses the code the API sends', async () => {
		respondWith(HTTP_NOT_FOUND, {
			statusCode: HTTP_NOT_FOUND,
			error: 'Not Found',
			code: 'sandbox_not_found',
			message: 'Sandbox not found',
		});

		await expect(startRejection()).resolves.toMatchObject({
			errorCode: 'sandbox_not_found',
		});
	});
});
