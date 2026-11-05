/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SHA256_HEX_LENGTH } from '../../../common/constants/digest.constants';
import { addMilliseconds } from '../../../common/utils/time.util';
import { SandboxLease } from '../../../marketplace/entities/sandbox-lease.entity';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import type { PriceCardRates } from '../../../marketplace/types/pricing.types';
import {
	priceTerms,
	priceUsage,
} from '../../../marketplace/utils/pricing.util';
import { MachineUsageReceipt } from '../../../sandbox/machine/entities/machine-usage-receipt.entity';
import {
	type SignedUsageReceipt,
	USAGE_ALLOCATION,
	USAGE_MACHINE_ID,
	USAGE_PLACEMENT,
} from '../../../sandbox/machine/testing/signed-usage-readings.fixtures';
import { USAGE_ACCOUNTING_POLICY_VERSION } from '../../../usage/constants/usage-accounting.constants';
import { UsageMode } from '../../../usage/constants/usage-lifecycle.constants';
import { SandboxBillableUsage } from '../../../usage/entities/sandbox-billable-usage.entity';
import {
	allocationColumns,
	allocationUnits,
	intendedQuantities,
	quantityColumns,
} from '../../../usage/utils/usage-quantities.util';
import {
	BillingBeneficiaryKind,
	BillingChargeClass,
	BillingEvidenceStatus,
	BillingLineSourceType,
} from '../../constants/billing.constants';
import { BillingLineItem } from '../../entities/billing-line-item.entity';
import type { PricedLease } from '../../queries/lease-price.query';

export const WINDOW_MARKUP_BASIS_POINTS = 2_500;

export const WINDOW_RATES: PriceCardRates = {
	vcpuHourMicroUsd: '3600000',
	memoryGibHourMicroUsd: '3600000',
	gpuHourMicroUsd: '3600000',
	diskGibMonthMicroUsd: '2628000000',
	stoppedDiskGibMonthMicroUsd: '1314000000',
	egressMicroUsdPerGiB: '50000',
};

export const WINDOW_TERMS = priceTerms(
	WINDOW_RATES,
	WINDOW_MARKUP_BASIS_POINTS
);

const USAGE_PERIOD_ID = '0e1d2c3b-4a59-4687-9a8b-7c6d5e4f3a2b';
const LINE_ID = '6c5b4a39-2817-4f6e-8d7c-6b5a49382716';
const LINE_CONTENT_DIGEST = 'a'.repeat(SHA256_HEX_LENGTH);
const LEASE_ID = '5d4c3b2a-1908-4f7e-8d6c-5b4a39281706';
const PRICE_CARD_ID = '4c3b2a19-0807-4e6d-8c5b-4a3928170605';

export const WINDOW_ALLOCATION = {
	cpu: allocationUnits(USAGE_ALLOCATION.cpu, 'CPU'),
	memoryGiB: allocationUnits(USAGE_ALLOCATION.memoryGiB, 'memory'),
	diskGiB: allocationUnits(USAGE_ALLOCATION.diskGiB, 'disk'),
	gpu: allocationUnits(USAGE_ALLOCATION.gpu, 'GPU'),
};

export function windowLease(): PricedLease {
	return {
		lease: Object.assign(new SandboxLease(), {
			id: LEASE_ID,
			sandboxId: USAGE_PLACEMENT.sandboxId,
			placementId: USAGE_PLACEMENT.placementId,
			customerOrganizationId: 'customer-organization-id',
			hostOrganizationId: 'host-organization-id',
			machineId: USAGE_MACHINE_ID,
			priceCardId: PRICE_CARD_ID,
			markupBasisPoints: WINDOW_MARKUP_BASIS_POINTS,
			placementKind: PlacementKind.FLEXIBLE,
		}),
		terms: WINDOW_TERMS,
	};
}

export function billableWindow(
	startAt: Date,
	durationMillis: number
): SandboxBillableUsage {
	const endAt = addMilliseconds(startAt, durationMillis);
	const quantities = intendedQuantities(
		WINDOW_ALLOCATION,
		UsageMode.FULL,
		BigInt(durationMillis)
	);
	const price = priceUsage(WINDOW_TERMS, quantities);
	return Object.assign(new SandboxBillableUsage(), {
		id: 'billable-id',
		usagePeriodId: USAGE_PERIOD_ID,
		sandboxId: USAGE_PLACEMENT.sandboxId,
		placementId: USAGE_PLACEMENT.placementId,
		machineId: USAGE_MACHINE_ID,
		leaseId: LEASE_ID,
		hostOrganizationId: 'host-organization-id',
		customerOrganizationId: 'customer-organization-id',
		assignmentGeneration: USAGE_PLACEMENT.assignmentGeneration,
		startAt,
		endAt,
		durationMillis: durationMillis.toString(),
		...allocationColumns(WINDOW_ALLOCATION),
		...quantityColumns(quantities),
		hostChargeMicroUsd: price.hostMicroUsd.toString(),
		markupChargeMicroUsd: price.markupMicroUsd.toString(),
		totalChargeMicroUsd: price.grossMicroUsd.toString(),
		policyVersion: USAGE_ACCOUNTING_POLICY_VERSION,
		evidenceStatus: BillingEvidenceStatus.PENDING,
		corroboratedAt: null,
		reconciliationReason: null,
		reconciledAt: null,
		reconcileAttempts: 0,
		nextReconcileAt: endAt,
	});
}

export function computeLine(billable: SandboxBillableUsage): BillingLineItem {
	return Object.assign(new BillingLineItem(), {
		id: LINE_ID,
		contentDigest: LINE_CONTENT_DIGEST,
		sourceType: BillingLineSourceType.SANDBOX_USAGE_PERIOD,
		sourceId: billable.usagePeriodId,
		sourceVersion: billable.policyVersion,
		chargeClass: BillingChargeClass.COMPUTE,
		customerOrganizationId: billable.customerOrganizationId,
		beneficiaryKind: BillingBeneficiaryKind.HOST_ORGANIZATION,
		hostOrganizationId: billable.hostOrganizationId,
		machineId: billable.machineId,
		placementId: billable.placementId,
		sandboxId: billable.sandboxId,
		assignmentGeneration: billable.assignmentGeneration,
		periodStart: billable.startAt,
		periodEnd: billable.endAt,
		leaseId: billable.leaseId,
		quantities: {
			vcpuMillis: billable.vcpuMillis,
			memoryGibMillis: billable.memoryGibMillis,
			gpuMillis: billable.gpuMillis,
			runningDiskGibMillis: billable.runningDiskGibMillis,
			stoppedDiskGibMillis: billable.stoppedDiskGibMillis,
		},
		grossMicroUsd: billable.totalChargeMicroUsd,
		hostMicroUsd: billable.hostChargeMicroUsd,
		markupMicroUsd: billable.markupChargeMicroUsd,
		evidenceStatus: BillingEvidenceStatus.PENDING,
	});
}

export function storedReceipts(
	chain: readonly SignedUsageReceipt[]
): MachineUsageReceipt[] {
	return chain.map((receipt) =>
		Object.assign(new MachineUsageReceipt(), {
			id: receipt.id,
			signerPublicKey: receipt.signerPublicKey,
			payloadDigest: receipt.payloadDigest,
			envelope: receipt.envelope,
			predecessorId: receipt.predecessor?.id ?? null,
		})
	);
}
