/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException } from '@nestjs/common';
import { PlacementBillingAuthorizationService } from '../../billing/services/placement/placement-billing-authorization.service';
import { PlacementBillingCapacityService } from '../../billing/services/placement/placement-billing-capacity.service';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { SandboxLeaseService } from '../../marketplace/services/sandbox-lease.service';
import { priceTerms } from '../../marketplace/utils/pricing.util';
import type { SandboxQuoteDto } from '../../sandbox/dto/sandbox-quote.dto';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SandboxMode } from '../../sandbox/enums/sandbox-mode.enum';
import { SandboxPlacementErrorCode } from '../../sandbox/enums/sandbox-placement-error-code.enum';
import { fakeSettings } from '../../settings/testing/settings.fake';
import { MachineAvailabilityService } from './machine-availability.service';
import { MachineSchedulingService } from './machine-scheduling.service';
import { PlacementQuoteService } from './placement-quote.service';
import { SandboxPlacementService } from './sandbox-placement.service';
import { SandboxPlacementControlService } from './sandbox-placement-control.service';

const CUSTOMER_ID = '2b000000-0000-4000-8000-000000000002';
const MACHINE_ID = '1a000000-0000-4000-8000-000000000001';
const LEASE_ID = '5e000000-0000-4000-8000-000000000005';
const QUOTED_CARD = '4d000000-0000-4000-8000-000000000004';
const CURRENT_CARD = '4d000000-0000-4000-8000-000000000005';
const MARKUP_BASIS_POINTS = 2_500;
const RATES = {
	vcpuHourMicroUsd: '10000',
	memoryGibHourMicroUsd: '1000',
	gpuHourMicroUsd: '0',
	diskGibMonthMicroUsd: '100',
	stoppedDiskGibMonthMicroUsd: '50',
	egressMicroUsdPerGiB: '0',
};
const CURRENT_QUOTE: SandboxQuoteDto = {
	placementKind: PlacementKind.PINNED,
	available: true,
	eligibleMachineCount: 1,
	machineId: MACHINE_ID,
	priceCardId: CURRENT_CARD,
	hourlyPriceMicroUsd: '31250',
	hostHourlyMicroUsd: '25000',
	markupHourlyMicroUsd: '6250',
	markupBasisPoints: MARKUP_BASIS_POINTS,
	stoppedHourlyPriceMicroUsd: '1712',
	dailyPriceMicroUsd: '750000',
	monthlyPriceMicroUsd: '22812500',
	minimumFundingMicroUsd: '31250',
	priceLockDays: 30,
};

function prototypeOf<Service extends object>(
	service: abstract new (...args: never[]) => Service
): Service {
	return Object.create(service.prototype);
}

function harness() {
	const manager = prototypeOf(EntityManager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'findOneOrFail', async () =>
		Object.assign(new MachineListing(), {
			machineId: MACHINE_ID,
			currentPriceCardId: CURRENT_CARD,
		})
	);

	const leases = prototypeOf(SandboxLeaseService);
	mock.method(leases, 'current', async () =>
		Object.assign(new SandboxLease(), { id: LEASE_ID, machineId: MACHINE_ID })
	);
	const renew = mock.method(leases, 'renew', async () => {
		throw new Error('a lease must not renew at a price the customer never saw');
	});

	const availability = prototypeOf(MachineAvailabilityService);
	mock.method(availability, 'pinnedTerms', async () => ({
		machine: new Machine(),
		priceCardId: CURRENT_CARD,
		terms: priceTerms(RATES, MARKUP_BASIS_POINTS),
	}));
	const quotes = prototypeOf(PlacementQuoteService);
	const quoteTerms = mock.method(
		quotes,
		'quoteTerms',
		async () => CURRENT_QUOTE
	);

	const service = new SandboxPlacementControlService(
		manager,
		prototypeOf(MachineSchedulingService),
		prototypeOf(PlacementBillingCapacityService),
		availability,
		prototypeOf(SandboxPlacementService),
		prototypeOf(PlacementBillingAuthorizationService),
		leases,
		quotes,
		fakeSettings()
	);
	return { service, renew, quoteTerms };
}

function stoppedSandbox(): Sandbox {
	return Object.assign(new Sandbox({}), {
		organizationId: CUSTOMER_ID,
		sandboxClass: SandboxClass.LINUX_VM,
		mode: SandboxMode.STANDARD,
		capabilities: [],
		snapshot: null,
		placementKind: PlacementKind.PINNED,
		pinnedMachineId: MACHINE_ID,
	});
}

describe('SandboxPlacementControlService.acceptRenewal', () => {
	it('answers price_changed with the current quote when the card moved since it was quoted', async () => {
		const { service, renew, quoteTerms } = harness();

		await assert.rejects(
			service.acceptRenewal(stoppedSandbox(), QUOTED_CARD),
			(error: unknown) => {
				assert.ok(error instanceof ConflictException);
				assert.deepEqual(error.getResponse(), {
					code: SandboxPlacementErrorCode.PRICE_CHANGED,
					message: 'The machine price changed since it was quoted',
					quote: CURRENT_QUOTE,
				});
				return true;
			}
		);
		assert.equal(renew.mock.callCount(), 0);
		const [call] = quoteTerms.mock.calls;
		assert.ok(call);
		const params = call.arguments[1];
		const details = call.arguments[3];
		assert.ok(params && details);
		assert.deepEqual(params.placement, {
			kind: PlacementKind.PINNED,
			machineId: MACHINE_ID,
		});
		assert.equal(params.customerOrganizationId, CUSTOMER_ID);
		assert.deepEqual(details.machine, {
			machineId: MACHINE_ID,
			priceCardId: CURRENT_CARD,
		});
	});
});
