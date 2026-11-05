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
import { ConflictException, HttpException } from '@nestjs/common';
import { BILLING_RESTRICTION_MESSAGES } from '../../billing/constants/billing-admission.constants';
import { BillingRestriction } from '../../billing/enums/billing-restriction.enum';
import { BillingRestrictedException } from '../../billing/exceptions/billing-restricted.exception';
import { PlacementBillingCapacityService } from '../../billing/services/placement/placement-billing-capacity.service';
import { fakeInstance } from '../../common/testing/instance.fake';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { Machine } from '../../machine/entities/machine.entity';
import type { CustomerMachineParams } from '../../machine/types/machine-scheduling.types';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import { MachineUnavailableReason } from '../../marketplace/enums/machine-unavailable-reason.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import {
	egressPricePerGiB,
	priceTerms,
	runningHourlyPrice,
} from '../../marketplace/utils/pricing.util';
import { PlacementLocality } from '../../sandbox/enums/placement-locality.enum';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SandboxPlacementErrorCode } from '../../sandbox/enums/sandbox-placement-error-code.enum';
import { MachineUnavailableException } from '../exceptions/machine-unavailable.exception';
import { NoAvailableMachineError } from '../exceptions/no-available-machine.exception';
import { platformWorkloadPlacement } from '../utils/sandbox-placement.util';
import { MachineAvailabilityService } from './machine-availability.service';
import { MachineReservationService } from './machine-reservation.service';
import {
	MachineSchedulingService,
	type PlacementCandidate,
} from './machine-scheduling.service';
import { PlacementQuoteService } from './placement-quote.service';

const CUSTOMER_ID = '2b000000-0000-4000-8000-000000000002';
const HOST_ID = '3c000000-0000-4000-8000-000000000003';
const CHEAP = '1a000000-0000-4000-8000-000000000001';
const DEAR = '1a000000-0000-4000-8000-000000000002';
const CURRENT_CARD = '4d000000-0000-4000-8000-000000000004';
const QUOTED_CARD = '4d000000-0000-4000-8000-000000000005';
const SHAPE = { cpu: 2, memoryGiB: 4, diskGiB: 20, gpu: 0 };
const MARKUP_BASIS_POINTS = 2_500;
const REQUIRED_MICRO_USD = MicroUsd.of(5_000n);
const RATES = {
	vcpuHourMicroUsd: '10000',
	memoryGibHourMicroUsd: '1000',
	gpuHourMicroUsd: '0',
	diskGibMonthMicroUsd: '100',
	stoppedDiskGibMonthMicroUsd: '50',
	egressMicroUsdPerGiB: '0',
};

function candidate(
	machineId: string,
	options: { priceCardId?: string | null; selfUse?: boolean } = {}
): PlacementCandidate {
	const selfUse = options.selfUse ?? false;
	const terms = priceTerms(RATES, selfUse ? 0 : MARKUP_BASIS_POINTS);
	const hourly = runningHourlyPrice(terms, SHAPE);
	return {
		machineId,
		location: null,
		locationPreference: 0,
		proximityBand: 0,
		hostOrganizationId: selfUse ? CUSTOMER_ID : HOST_ID,
		priceCardId:
			options.priceCardId === undefined ? CURRENT_CARD : options.priceCardId,
		selfUse,
		terms,
		hourly,
		hourlyGrossMicroUsd: hourly.grossMicroUsd,
		egressGrossMicroUsdPerGiB: egressPricePerGiB(terms).grossMicroUsd,
		gpuTypePriority: 0,
		reliabilityBasisPoints: 9_000,
		locality: PlacementLocality.REMOTE,
	};
}

function flexible(): CustomerMachineParams {
	return {
		customerOrganizationId: CUSTOMER_ID,
		placement: platformWorkloadPlacement(),
		sandboxClass: SandboxClass.LINUX_VM,
		gpu: 0,
		gpuType: null,
		cpu: SHAPE.cpu,
		memoryGiB: SHAPE.memoryGiB,
		diskGiB: SHAPE.diskGiB,
	};
}

function pinned(machineId: string): CustomerMachineParams {
	return {
		...flexible(),
		placement: { kind: PlacementKind.PINNED, machineId },
	};
}

interface HarnessOptions {
	ranked: PlacementCandidate[];
	admitted?: readonly string[];
	rejectedAfterLock?: readonly string[];
	admissionRestriction?: BillingRestriction;
	restrictionAfterLock?: BillingRestriction;
}

function restricted(
	restriction: BillingRestriction
): BillingRestrictedException {
	return new BillingRestrictedException(restriction, {
		requiredMicroUsd: REQUIRED_MICRO_USD,
		availableMicroUsd: MicroUsd.ZERO,
	});
}

function assertRestricted(restriction: BillingRestriction) {
	return (error: unknown) => {
		assert.ok(error instanceof BillingRestrictedException);
		const body = error.getResponse();
		assert.ok(typeof body === 'object' && 'code' in body && 'message' in body);
		assert.equal(body.code, restriction);
		assert.equal(body.message, BILLING_RESTRICTION_MESSAGES[restriction]);
		return true;
	};
}

function harness(options: HarnessOptions) {
	const admitted = new Set(
		options.admitted ?? options.ranked.map(({ machineId }) => machineId)
	);
	const rejected = new Set(options.rejectedAfterLock ?? []);
	const admissionRestriction = options.admissionRestriction;
	const restrictionAfterLock = options.restrictionAfterLock;
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'isInTransaction', () => true);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'getMetadata', () => ({
		tableName: 'machine',
		primaryKeys: ['id'],
		properties: { id: { columnTypes: ['uuid'] } },
	}));
	mock.method(manager, 'getPlatform', () => ({
		quoteIdentifier: (name: string) => name,
	}));
	mock.method(manager, 'execute', async () => []);
	mock.method(
		manager,
		'find',
		async (...lookup: [unknown, { $and: [{ id: { $in: string[] } }] }]) =>
			lookup[1].$and[0].id.$in.map((id) =>
				Object.assign(new Machine(), { id, organizationId: HOST_ID })
			)
	);
	mock.method(manager, 'findOne', async () =>
		Object.assign(new MachineListing(), { currentPriceCardId: CURRENT_CARD })
	);

	const scheduling = fakeInstance(MachineSchedulingService);
	mock.method(scheduling, 'rank', async () => options.ranked);
	mock.method(
		scheduling,
		'eligibleMachines',
		async (...args: Parameters<MachineSchedulingService['eligibleMachines']>) =>
			options.ranked.filter(({ machineId }) =>
				(args[2] ?? []).includes(machineId)
			)
	);
	const capacity = fakeInstance(PlacementBillingCapacityService);
	mock.method(
		capacity,
		'admit',
		async (...args: Parameters<PlacementBillingCapacityService['admit']>) => {
			const passed = args[2].filter(({ machineId }) => admitted.has(machineId));
			return {
				admitted: passed,
				restriction:
					passed.length === 0 && admissionRestriction
						? restricted(admissionRestriction)
						: null,
			};
		}
	);
	mock.method(
		capacity,
		'assertAdmissible',
		async (
			...args: Parameters<PlacementBillingCapacityService['assertAdmissible']>
		) => {
			if (restrictionAfterLock) throw restricted(restrictionAfterLock);
			if (rejected.has(args[1].machine.id)) {
				throw new ConflictException('machine exposure limited');
			}
		}
	);
	const availability = fakeInstance(MachineAvailabilityService);
	mock.method(
		availability,
		'unavailable',
		async (...args: Parameters<MachineAvailabilityService['unavailable']>) =>
			new MachineUnavailableException(
				args[2],
				MachineUnavailableReason.FULL,
				[]
			)
	);
	const quotes = fakeInstance(PlacementQuoteService);
	mock.method(
		quotes,
		'quoteCandidate',
		async (...args: Parameters<PlacementQuoteService['quoteCandidate']>) => ({
			machineId: args[2].machineId,
			priceCardId: args[2].priceCardId,
		})
	);
	return {
		manager,
		service: new MachineReservationService(
			scheduling,
			capacity,
			availability,
			quotes
		),
	};
}

describe('flexible reservation', () => {
	it('reserves the best ranked admissible machine', async () => {
		const { manager, service } = harness({
			ranked: [candidate(CHEAP), candidate(DEAR)],
		});
		const reserved = await service.reserve(manager, flexible());
		assert.equal(reserved.machine.id, CHEAP);
	});

	it('falls through a machine whose exposure ceiling is reached before selection', async () => {
		const { manager, service } = harness({
			ranked: [candidate(CHEAP), candidate(DEAR)],
			admitted: [DEAR],
		});
		const reserved = await service.reserve(manager, flexible());
		assert.equal(reserved.machine.id, DEAR);
	});

	it('falls through a machine whose capacity fails once its row is locked', async () => {
		const { manager, service } = harness({
			ranked: [candidate(CHEAP), candidate(DEAR)],
			rejectedAfterLock: [CHEAP],
		});
		const reserved = await service.reserve(manager, flexible());
		assert.equal(reserved.machine.id, DEAR);
	});

	it('reports no machine when every candidate is capped', async () => {
		const { manager, service } = harness({
			ranked: [candidate(CHEAP)],
			admitted: [],
		});
		await assert.rejects(
			service.reserve(manager, flexible()),
			NoAvailableMachineError
		);
	});

	it('reports an exhausted network budget instead of no machine', async () => {
		const { manager, service } = harness({
			ranked: [candidate(CHEAP), candidate(DEAR)],
			admitted: [],
			admissionRestriction: BillingRestriction.NETWORK_BUDGET_EXHAUSTED,
		});
		await assert.rejects(
			service.reserve(manager, flexible()),
			assertRestricted(BillingRestriction.NETWORK_BUDGET_EXHAUSTED)
		);
	});

	it('reports insufficient credit when the locked self-use machine cannot be funded', async () => {
		const { manager, service } = harness({
			ranked: [candidate(CHEAP, { selfUse: true, priceCardId: null })],
			restrictionAfterLock: BillingRestriction.INSUFFICIENT_CREDIT,
		});
		await assert.rejects(
			service.reserve(manager, flexible()),
			assertRestricted(BillingRestriction.INSUFFICIENT_CREDIT)
		);
	});
});

describe('pinned reservation', () => {
	it('reserves the pinned machine at the quoted card', async () => {
		const { manager, service } = harness({ ranked: [candidate(CHEAP)] });
		const reserved = await service.reserve(
			manager,
			pinned(CHEAP),
			[],
			CURRENT_CARD
		);
		assert.equal(reserved.machine.id, CHEAP);
	});

	it('answers machine_unavailable with alternatives when the machine cannot take it', async () => {
		const { manager, service } = harness({
			ranked: [candidate(CHEAP)],
			rejectedAfterLock: [CHEAP],
		});
		await assert.rejects(
			service.reserve(manager, pinned(CHEAP)),
			MachineUnavailableException
		);
	});

	it('answers insufficient credit for a self-use machine of an organization without credit', async () => {
		const { manager, service } = harness({
			ranked: [candidate(CHEAP, { selfUse: true, priceCardId: null })],
			restrictionAfterLock: BillingRestriction.INSUFFICIENT_CREDIT,
		});
		await assert.rejects(
			service.reserve(manager, pinned(CHEAP)),
			assertRestricted(BillingRestriction.INSUFFICIENT_CREDIT)
		);
	});

	it('answers price_changed with the new quote when the card moved since the quote', async () => {
		const { manager, service } = harness({ ranked: [candidate(CHEAP)] });
		await assert.rejects(
			service.reserve(manager, pinned(CHEAP), [], QUOTED_CARD),
			(error: unknown) => {
				assert.ok(error instanceof HttpException);
				const body = error.getResponse();
				assert.ok(
					typeof body === 'object' && 'code' in body && 'quote' in body
				);
				const { quote } = body;
				assert.ok(
					typeof quote === 'object' && quote !== null && 'priceCardId' in quote
				);
				assert.equal(body.code, SandboxPlacementErrorCode.PRICE_CHANGED);
				assert.equal(quote.priceCardId, CURRENT_CARD);
				return true;
			}
		);
	});

	it('ignores the quoted card for an unpriced machine of the same organization', async () => {
		const { manager, service } = harness({
			ranked: [candidate(CHEAP, { selfUse: true, priceCardId: null })],
		});
		const reserved = await service.reserve(
			manager,
			pinned(CHEAP),
			[],
			QUOTED_CARD
		);
		assert.equal(reserved.machine.id, CHEAP);
	});
});
