/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	BillingChargeClass,
	BillingEvidenceStatus,
} from '../constants/billing.constants';
import type { BillingLineItemDto } from '../dto/billing.dto';
import { billingExportCsv, billingExportRow } from './billing-export.util';

const line = {
	id: 'line-id',
	customerOrganizationId: 'customer-id',
	chargeClass: BillingChargeClass.COMPUTE,
	sandboxId: 'sandbox-id',
	placementId: 'placement-id',
	machineId: 'machine-id',
	hostOrganizationId: 'host-id',
	resourceSku: 'cpu-small',
	periodStart: new Date('2026-09-30T23:30:00.000Z'),
	periodEnd: new Date('2026-10-01T00:30:00.000Z'),
	grossMicroUsd: '1250000',
	adjustmentMicroUsd: '-250000',
	effectiveMicroUsd: '1000000',
	consumedQuantities: {
		durationMillis: '3600000',
		cpu: '1.000000',
		memoryGiB: '2.000000',
		diskGiB: '10.000000',
		gpu: '0.000000',
	},
	leaseId: '5d4c3b2a-1908-4f7e-8d6c-5b4a39281706',
	quantities: {
		vcpuMillis: '3600000.000000',
		memoryGibMillis: '7200000.000000',
		gpuMillis: '0.000000',
		runningDiskGibMillis: '0.000000',
		stoppedDiskGibMillis: '0.000000',
	},
	evidenceStatus: BillingEvidenceStatus.CORROBORATED,
	contentDigest: 'digest',
	reconciledAt: new Date('2026-10-09T00:00:00.000Z'),
	sourceType: 'sandbox_usage_period',
	sourceId: 'source-id',
	schemaVersion: 1,
} satisfies BillingLineItemDto;

describe('billing FOCUS export', () => {
	it('exports exact currency units and FOCUS billing periods', () => {
		const row = billingExportRow(line);
		assert.equal(row.BilledCost, '1');
		assert.equal(row.ContractedCost, '1.25');
		assert.equal(row.ConsumedQuantity, '1');
		assert.equal(row.BillingPeriodStart, '2026-09-01T00:00:00.000Z');
		assert.equal(row.BillingPeriodEnd, '2026-10-01T00:00:00.000Z');
		assert.equal(row.x_SnapflowAdjustmentCost, '-0.25');
	});

	it('quotes JSON-valued custom columns in CSV', () => {
		const csv = billingExportCsv([billingExportRow(line)]);
		assert.match(csv, /x_SnapflowRawConsumedQuantities/);
		assert.match(csv, /""durationMillis""/);
	});
});
