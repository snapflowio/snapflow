/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import {
	MILLISECONDS_PER_DAY,
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_SECOND,
} from '../../common/constants/time.constants';
import { fakeInstance } from '../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import { MACHINE_QUALIFICATION_POLICY } from '../../machine/constants/machine-qualification.constants';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineAssessment } from '../../machine/entities/machine-assessment.entity';
import { SELF_USE_MARKUP_BASIS_POINTS } from '../../marketplace/constants/marketplace.constants';
import { MachinePriceCard } from '../../marketplace/entities/machine-price-card.entity';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { Organization } from '../../organization/entities/organization.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SandboxMode } from '../../sandbox/enums/sandbox-mode.enum';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { fakeSettings } from '../../settings/testing/settings.fake';
import { PaymentChannel } from '../../settlement/entities/payment-channel.entity';
import { USAGE_ACCOUNTING_POLICY_VERSION } from '../../usage/constants/usage-accounting.constants';
import { SandboxBillableUsage } from '../../usage/entities/sandbox-billable-usage.entity';
import { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';
import { User } from '../../user/entities/user.entity';
import {
	BillingEvidenceStatus,
	PlacementFundingState,
} from '../constants/billing.constants';
import { PLACEMENT_AUTHORIZATION_CREATED_BY } from '../constants/billing-admission.constants';
import { MACHINE_TRUST_POLICY } from '../constants/machine-trust.constants';
import { BillingLineItem } from '../entities/billing-line-item.entity';
import { PlacementBillingAuthorization } from '../entities/placement-billing-authorization.entity';
import { BillingLineItemService } from './billing-line-item.service';
import { PlacementBillingAuthorizationService } from './placement/placement-billing-authorization.service';
import { PlacementBillingCapacityService } from './placement/placement-billing-capacity.service';

const DATABASE_URL = integrationDatabaseUrl();
const SANDBOX_CPU = 1;
const SANDBOX_MEMORY_GIB = 1;
const SANDBOX_DISK_GIB = 1;
const ASSIGNMENT_GENERATION = 1;
const RESERVED_MICRO_USD = MicroUsd.of(1_000_000n);
const CHARGE_MICRO_USD = MicroUsd.of(250_000n);
const USAGE_MILLISECONDS = 60 * MILLISECONDS_PER_SECOND;
const BLOCKER_POLL_MILLISECONDS = 10;
const BLOCKER_WAIT_MILLISECONDS = 10 * MILLISECONDS_PER_SECOND;

interface Gate {
	opened: Promise<void>;
	open: () => void;
}

function gate(): Gate {
	let open = () => {};
	const opened = new Promise<void>((resolve) => {
		open = resolve;
	});
	return { opened, open };
}

describe('billing lock order under concurrency', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	const organizationId = randomUUID();
	const leaseId = randomUUID();
	const placementId = randomUUID();
	const machine = new Machine({
		name: `billing-lock-order-${randomUUID()}`,
		apiVersion: '1',
		organizationId,
	});
	const sandbox = Object.assign(new Sandbox({}), {
		organizationId,
		mode: SandboxMode.STANDARD,
		osUser: 'snapflow',
		state: SandboxState.STARTED,
		machineId: machine.id,
	});

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [
				Organization,
				User,
				Machine,
				MachineAssessment,
				MachinePriceCard,
				Sandbox,
				SandboxPlacement,
				SandboxLease,
				PlacementBillingAuthorization,
				BillingLineItem,
				PaymentChannel,
			],
		});
		await seed(orm.em.fork());
	});

	after(async () => {
		if (!orm) return;
		await unseed(orm.em.fork());
		await orm.close(true);
	});

	it('posts compute usage while the toolbox renews the same authorization', async () => {
		const postingLocked = gate();
		const posting = orm.em.fork().transactional(async (manager) => {
			await new BillingLineItemService().projectCompute(
				manager,
				usagePeriod(),
				billableUsage()
			);
			postingLocked.open();
			await waitUntilBlocking(await backendPid(manager));
		});
		await Promise.race([postingLocked.opened, posting]);
		const renewal = orm.em
			.fork()
			.transactional((manager) =>
				authorizations().renewForSandbox(manager, sandbox)
			);

		const outcomes = await Promise.allSettled([posting, renewal]);

		assert.deepEqual(
			outcomes.map((outcome) =>
				outcome.status === 'rejected' ? String(outcome.reason) : outcome.status
			),
			['fulfilled', 'fulfilled']
		);
		const authorization = await orm.em
			.fork()
			.findOneOrFail(PlacementBillingAuthorization, { placementId });
		assert.equal(
			authorization.remainingReservedMicroUsd,
			RESERVED_MICRO_USD.toString()
		);
		assert.equal(
			await orm.em.fork().count(BillingLineItem, { placementId }),
			1
		);
	});

	async function seed(manager: EntityManager): Promise<void> {
		const now = new Date();
		manager.create(
			Organization,
			{ id: organizationId, name: organizationId, slug: organizationId },
			{ partial: true }
		);
		await manager.flush();
		manager.persist([machine, sandbox]);
		await manager.flush();
		manager.create(
			MachineAssessment,
			{
				machineId: machine.id,
				qualified: true,
				qualificationExpiresAt: new Date(now.getTime() + MILLISECONDS_PER_HOUR),
				qualificationPolicyVersion: MACHINE_QUALIFICATION_POLICY.VERSION,
				policyVersion: MACHINE_TRUST_POLICY.version,
				assessedAt: now,
			},
			{ partial: true }
		);
		manager.create(SandboxPlacement, {
			id: placementId,
			sandboxId: sandbox.id,
			machineId: machine.id,
			assignmentGeneration: ASSIGNMENT_GENERATION,
			fencingToken: randomUUID(),
			placementKind: PlacementKind.FLEXIBLE,
			placedAt: now,
			releasedAt: null,
			releaseReason: null,
		});
		await manager.flush();
		await manager.execute(
			`INSERT INTO sandbox_lease
				(id, "sandboxId", "placementId", "customerOrganizationId", "hostOrganizationId",
				 "machineId", "markupBasisPoints", "placementKind", cpu, "memoryGib", "diskGib",
				 gpu, "startedAt", "priceLockedUntil")
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
			[
				leaseId,
				sandbox.id,
				placementId,
				organizationId,
				organizationId,
				machine.id,
				SELF_USE_MARKUP_BASIS_POINTS,
				PlacementKind.FLEXIBLE,
				SANDBOX_CPU,
				SANDBOX_MEMORY_GIB,
				SANDBOX_DISK_GIB,
				now,
				new Date(now.getTime() + MILLISECONDS_PER_DAY),
			]
		);
		manager.create(PlacementBillingAuthorization, {
			placementId,
			sandboxId: sandbox.id,
			assignmentGeneration: ASSIGNMENT_GENERATION,
			customerOrganizationId: organizationId,
			hostOrganizationId: organizationId,
			leaseId,
			estimatedHourlyMicroUsd: CHARGE_MICRO_USD.toString(),
			reservedMicroUsd: RESERVED_MICRO_USD.toString(),
			remainingReservedMicroUsd: RESERVED_MICRO_USD.toString(),
			createdBy: PLACEMENT_AUTHORIZATION_CREATED_BY,
			createdAt: now,
			expiresAt: new Date(now.getTime() + MILLISECONDS_PER_HOUR),
			fundingState: PlacementFundingState.HEALTHY,
			fundingStateChangedAt: now,
			billingCutoffAt: null,
			releasedAt: null,
		});
		await manager.flush();
	}

	async function unseed(manager: EntityManager): Promise<void> {
		await manager.nativeDelete(BillingLineItem, { placementId });
		await manager.nativeDelete(PlacementBillingAuthorization, { placementId });
		await manager.nativeDelete(SandboxLease, { id: leaseId });
		await manager.nativeDelete(SandboxPlacement, { id: placementId });
		await manager.nativeDelete(MachineAssessment, { machineId: machine.id });
		await manager.nativeDelete(Sandbox, { id: sandbox.id });
		await manager.nativeDelete(Machine, { id: machine.id });
		await manager.nativeDelete(Organization, { id: organizationId });
	}

	async function backendPid(manager: EntityManager): Promise<number> {
		const [row] = await manager.execute<{ pid: number }[]>(
			'SELECT pg_backend_pid() AS pid'
		);
		return row.pid;
	}

	async function waitUntilBlocking(pid: number): Promise<void> {
		const deadline = Date.now() + BLOCKER_WAIT_MILLISECONDS;
		while (Date.now() < deadline) {
			const [row] = await orm.em.fork().execute<{ blocking: boolean }[]>(
				`SELECT EXISTS (
					SELECT 1 FROM pg_stat_activity
					WHERE ?::integer = ANY(pg_blocking_pids(pid))
				) AS blocking`,
				[pid]
			);
			if (row.blocking) return;
			await sleep(BLOCKER_POLL_MILLISECONDS);
		}
		throw new Error(`No transaction waited on backend ${pid}`);
	}

	function authorizations(): PlacementBillingAuthorizationService {
		return new PlacementBillingAuthorizationService(
			fakeInstance(PlacementBillingCapacityService, {
				runwayReservation: async () => ({
					totalMicroUsd: RESERVED_MICRO_USD,
					networkMicroUsd: MicroUsd.ZERO,
				}),
				assertCapacity: async () => undefined,
			}),
			fakeSettings()
		);
	}

	function usagePeriod(): SandboxUsagePeriod {
		return Object.assign(new SandboxUsagePeriod(), {
			id: randomUUID(),
			sandboxClass: SandboxClass.LINUX_VM,
		});
	}

	function billableUsage(): SandboxBillableUsage {
		const endAt = new Date();
		return Object.assign(new SandboxBillableUsage(), {
			customerOrganizationId: organizationId,
			hostOrganizationId: organizationId,
			sandboxId: sandbox.id,
			placementId,
			machineId: machine.id,
			assignmentGeneration: ASSIGNMENT_GENERATION,
			startAt: new Date(endAt.getTime() - USAGE_MILLISECONDS),
			endAt,
			leaseId,
			durationMillis: USAGE_MILLISECONDS.toString(),
			cpu: SANDBOX_CPU.toString(),
			memoryGiB: SANDBOX_MEMORY_GIB.toString(),
			diskGiB: SANDBOX_DISK_GIB.toString(),
			gpu: '0',
			vcpuMillis: USAGE_MILLISECONDS.toString(),
			memoryGibMillis: USAGE_MILLISECONDS.toString(),
			gpuMillis: '0',
			runningDiskGibMillis: USAGE_MILLISECONDS.toString(),
			stoppedDiskGibMillis: '0',
			hostChargeMicroUsd: CHARGE_MICRO_USD.toString(),
			markupChargeMicroUsd: '0',
			totalChargeMicroUsd: CHARGE_MICRO_USD.toString(),
			policyVersion: USAGE_ACCOUNTING_POLICY_VERSION,
			evidenceStatus: BillingEvidenceStatus.PENDING,
			reconciliationReason: null,
			reconciledAt: null,
		});
	}
});
