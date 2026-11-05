/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_HOUR } from '../../common/constants/time.constants';
import { decimalScale } from '../../common/utils/fixed-point.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	BILLING_EXPORT_FOCUS_VERSION,
	BILLING_EXPORT_SCHEMA_VERSION,
	BillingChargeClass,
	BillingEvidenceStatus,
} from '../constants/billing.constants';
import type { BillingLineItemDto } from '../dto/billing.dto';
import { utcBillingMonth } from './billing-period.util';

const QUANTITY_DECIMAL_PLACES = 9;
const QUANTITY_SCALE = decimalScale(QUANTITY_DECIMAL_PLACES);
const SNAPFLOW_PROVIDER = 'Snapflow';

const CHARGE_CLASS_EXPORT = {
	[BillingChargeClass.COMPUTE]: {
		description: 'Snapflow compute usage',
		unit: 'sandbox-hour',
		serviceCategory: 'Compute',
		serviceName: 'Snapflow Compute',
		serviceSubcategory: 'Virtual Machine',
		skuMeter: 'Sandbox Runtime',
	},
	[BillingChargeClass.NETWORK]: {
		description: 'Snapflow network usage',
		unit: 'byte',
		serviceCategory: 'Networking',
		serviceName: 'Snapflow Networking',
		serviceSubcategory: 'Data Transfer',
		skuMeter: 'Network Data Transfer',
	},
} as const satisfies Record<BillingChargeClass, Record<string, string>>;

export type BillingExportRow = Record<string, string>;

export function billingExportRow(line: BillingLineItemDto): BillingExportRow {
	const billingPeriod = utcBillingMonth(line.periodStart);
	const charge = CHARGE_CLASS_EXPORT[line.chargeClass];
	const consumedQuantity = consumedQuantityOf(line);
	const effectiveCost = microUsdToUsd(line.effectiveMicroUsd);
	const grossCost = microUsdToUsd(line.grossMicroUsd);
	const posted = line.evidenceStatus === BillingEvidenceStatus.CORROBORATED;
	return {
		BilledCost: posted ? effectiveCost : '0',
		BillingAccountId: line.customerOrganizationId,
		BillingAccountName: line.customerOrganizationId,
		BillingCurrency: 'USD',
		BillingPeriodEnd: billingPeriod.end.toISOString(),
		BillingPeriodStart: billingPeriod.start.toISOString(),
		ChargeCategory: 'Usage',
		ChargeClass: '',
		ChargeDescription: `${charge.description} (${line.resourceSku})`,
		ChargeFrequency: 'Usage-Based',
		ChargePeriodEnd: line.periodEnd.toISOString(),
		ChargePeriodStart: line.periodStart.toISOString(),
		ConsumedQuantity: consumedQuantity,
		ConsumedUnit: charge.unit,
		ContractedCost: grossCost,
		EffectiveCost: effectiveCost,
		InvoiceId: '',
		InvoiceIssuer: SNAPFLOW_PROVIDER,
		ListCost: grossCost,
		PricingCategory: 'Standard',
		PricingCurrency: 'USD',
		PricingQuantity: consumedQuantity,
		PricingUnit: charge.unit,
		Provider: line.hostOrganizationId ?? SNAPFLOW_PROVIDER,
		Publisher: SNAPFLOW_PROVIDER,
		ResourceId: line.sandboxId,
		ResourceName: line.sandboxId,
		ResourceType: 'Sandbox',
		ServiceCategory: charge.serviceCategory,
		ServiceName: charge.serviceName,
		ServiceSubcategory: charge.serviceSubcategory,
		SkuId: line.resourceSku,
		SkuMeter: charge.skuMeter,
		SubAccountId: line.sandboxId,
		SubAccountName: line.sandboxId,
		x_SnapflowAdjustmentCost: microUsdToUsd(line.adjustmentMicroUsd),
		x_SnapflowContentDigest: line.contentDigest,
		x_SnapflowEvidenceStatus: line.evidenceStatus,
		x_SnapflowFocusVersion: BILLING_EXPORT_FOCUS_VERSION,
		x_SnapflowLineItemId: line.id,
		x_SnapflowLeaseId: line.leaseId ?? '',
		x_SnapflowQuantities: line.quantities
			? JSON.stringify(line.quantities)
			: '',
		x_SnapflowRawConsumedQuantities: JSON.stringify(line.consumedQuantities),
		x_SnapflowSchemaVersion: BILLING_EXPORT_SCHEMA_VERSION.toString(),
		x_SnapflowSourceId: line.sourceId,
		x_SnapflowSourceType: line.sourceType,
	};
}

export function billingExportCsv(rows: readonly BillingExportRow[]): string {
	const first = rows[0];
	if (!first) return '';
	const columns = Object.keys(first);
	return [
		columns.join(','),
		...rows.map((row) =>
			columns.map((column) => escapeCsvField(row[column] ?? '')).join(',')
		),
	].join('\n');
}

function consumedQuantityOf(line: BillingLineItemDto): string {
	if (line.chargeClass === BillingChargeClass.NETWORK) {
		return readQuantity(line.consumedQuantities, 'billedEgressBytes');
	}
	return ratio(
		BigInt(readQuantity(line.consumedQuantities, 'durationMillis')),
		BigInt(MILLISECONDS_PER_HOUR)
	);
}

function readQuantity(
	quantities: BillingLineItemDto['consumedQuantities'],
	name: string
): string {
	const value = Reflect.get(quantities, name);
	if (typeof value !== 'string' || !/^\d+$/.test(value)) {
		throw new Error(`Billing export quantity ${name} is invalid`);
	}
	return value;
}

function microUsdToUsd(value: string): string {
	if (!/^-?\d+$/.test(value)) {
		throw new Error('Billing export cost is invalid');
	}
	return MicroUsd.parse(value).toUsd();
}

function ratio(numerator: bigint, denominator: bigint): string {
	if (numerator < 0n || denominator <= 0n) {
		throw new Error('Billing export ratio is invalid');
	}
	const scaled = (numerator * QUANTITY_SCALE) / denominator;
	const fraction = (scaled % QUANTITY_SCALE)
		.toString()
		.padStart(QUANTITY_DECIMAL_PLACES, '0')
		.replace(/0+$/, '');
	const whole = scaled / QUANTITY_SCALE;
	return fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
}

function escapeCsvField(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}
