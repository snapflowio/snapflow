/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { USAGE_FINALIZATION_LOCK_NAMESPACE } from '../../common/constants/advisory-lock.constants';
import { millisecondsBetween } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { priceUsage } from '../../marketplace/utils/pricing.util';
import {
	INITIAL_RECONCILE_ATTEMPTS,
	INITIAL_USAGE_RECEIPT_COUNT,
	USAGE_ACCOUNTING_POLICY_VERSION,
	USAGE_ZERO_QUANTITY,
} from '../../usage/constants/usage-accounting.constants';
import { SandboxBillableUsage } from '../../usage/entities/sandbox-billable-usage.entity';
import type { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';
import type { UsagePeriodFinalizer } from '../../usage/services/usage-period-finalizer.service';
import {
	allocationColumns,
	allocationUnits,
	intendedQuantities,
	quantityColumns,
} from '../../usage/utils/usage-quantities.util';
import {
	BillingEvidenceStatus,
	BillingLineSourceType,
} from '../constants/billing.constants';
import type { BillingEvidenceBundle } from '../entities/billing-evidence-bundle.entity';
import type { BillingLineItem } from '../entities/billing-line-item.entity';
import { PlacementBillingAuthorization } from '../entities/placement-billing-authorization.entity';
import { type PricedLease, pricedLease } from '../queries/lease-price.query';
import type { UsageAttestation } from '../utils/evidence/usage-attestation.util';
import { BillingLineItemService } from './billing-line-item.service';
import { BillingAttestationService } from './evidence/billing-attestation.service';

@Injectable()
export class UsageBillingService implements UsagePeriodFinalizer {
	constructor(
		private readonly billingLines: BillingLineItemService,
		private readonly attestations: BillingAttestationService
	) {}

	async finalize(
		manager: EntityManager,
		period: SandboxUsagePeriod
	): Promise<SandboxBillableUsage | null> {
		if (!period.endAt) throw new Error('Open usage period cannot be finalized');
		await manager.execute(
			'SELECT pg_advisory_xact_lock(hashtextextended(?, ?))',
			[period.id, USAGE_FINALIZATION_LOCK_NAMESPACE]
		);
		const existing = await manager.findOne(SandboxBillableUsage, {
			usagePeriodId: period.id,
		});
		if (existing) return existing;
		const durationMillis = BigInt(
			millisecondsBetween(period.startAt, period.endAt)
		);
		if (durationMillis <= 0n) return null;
		const allocation = {
			cpu: allocationUnits(period.cpu, 'CPU'),
			memoryGiB: allocationUnits(period.mem, 'memory'),
			diskGiB: allocationUnits(period.disk, 'disk'),
			gpu: allocationUnits(period.gpu, 'GPU'),
		};
		const quantities = intendedQuantities(
			allocation,
			period.mode,
			durationMillis
		);
		const { terms } = await pricedLease(manager, period.leaseId);
		const price = priceUsage(terms, quantities);
		if (price.grossMicroUsd.isZero()) return null;
		await this.assertAuthorized(manager, period);
		const billable = manager.create(SandboxBillableUsage, {
			id: randomUUID(),
			usagePeriodId: period.id,
			sandboxId: period.sandboxId,
			customerOrganizationId: period.customerOrganizationId,
			hostOrganizationId: period.hostOrganizationId,
			placementId: period.placementId,
			machineId: period.machineId,
			assignmentGeneration: period.assignmentGeneration,
			startAt: period.startAt,
			endAt: period.endAt,
			leaseId: period.leaseId,
			durationMillis: durationMillis.toString(),
			...allocationColumns(allocation),
			...quantityColumns(quantities),
			hostChargeMicroUsd: price.hostMicroUsd.toString(),
			markupChargeMicroUsd: price.markupMicroUsd.toString(),
			totalChargeMicroUsd: price.grossMicroUsd.toString(),
			policyVersion: USAGE_ACCOUNTING_POLICY_VERSION,
			evidenceStatus: BillingEvidenceStatus.PENDING,
			corroboratedAt: null,
			observedComputeMillis: USAGE_ZERO_QUANTITY,
			observedStorageMillis: USAGE_ZERO_QUANTITY,
			receiptCount: INITIAL_USAGE_RECEIPT_COUNT,
			reconciliationReason: null,
			reconciledAt: null,
			reconcileAttempts: INITIAL_RECONCILE_ATTEMPTS,
			nextReconcileAt: period.endAt,
			createdAt: await databaseNow(manager),
		});
		manager.persist(billable);
		await this.billingLines.projectCompute(manager, period, billable);
		return billable;
	}

	private async assertAuthorized(
		manager: EntityManager,
		period: SandboxUsagePeriod
	): Promise<void> {
		const authorization = await manager.findOne(PlacementBillingAuthorization, {
			placementId: period.placementId,
		});
		if (!authorization) {
			throw new Error(
				`Placement ${period.placementId} has no billing authorization`
			);
		}
		if (
			authorization.sandboxId !== period.sandboxId ||
			authorization.assignmentGeneration !== period.assignmentGeneration ||
			authorization.customerOrganizationId !== period.customerOrganizationId ||
			authorization.hostOrganizationId !== period.hostOrganizationId
		) {
			throw new Error(
				`Placement ${period.placementId} billing authorization does not match its usage period`
			);
		}
	}

	lockLine(
		manager: EntityManager,
		billable: SandboxBillableUsage
	): Promise<BillingLineItem> {
		return this.billingLines.findRequired(
			manager,
			BillingLineSourceType.SANDBOX_USAGE_PERIOD,
			billable.usagePeriodId,
			LockMode.PESSIMISTIC_WRITE
		);
	}

	async corroborate(
		manager: EntityManager,
		billable: SandboxBillableUsage,
		line: BillingLineItem,
		bundle: BillingEvidenceBundle,
		attestation: UsageAttestation,
		reconciledAt: Date,
		lease: PricedLease
	): Promise<SandboxBillableUsage> {
		if (billable.evidenceStatus !== BillingEvidenceStatus.PENDING) {
			throw new Error('Usage record is not eligible for reconciliation');
		}
		await this.attestations.corroborate(
			manager,
			line,
			bundle,
			attestation,
			reconciledAt,
			lease
		);
		billable.observedComputeMillis = attestation.computeMillis.toString();
		billable.observedStorageMillis = attestation.storageMillis.toString();
		billable.receiptCount = attestation.receiptCount;
		billable.evidenceStatus = line.evidenceStatus;
		billable.reconciliationReason = line.reconciliationReason;
		billable.corroboratedAt = reconciledAt;
		billable.reconciledAt = reconciledAt;
		return billable;
	}
}
