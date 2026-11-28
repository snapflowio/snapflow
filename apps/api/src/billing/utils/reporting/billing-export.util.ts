/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_HOUR } from '../../../common/constants/time.constants';
import type { CsvRow } from '../../../common/utils/csv.util';
import { decimalScale } from '../../../common/utils/fixed-point.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	BILLING_EXPORT_FOCUS_VERSION,
	BILLING_EXPORT_SCHEMA_VERSION,
	BillingEvidenceStatus,
	BillingLineCategory,
} from '../../constants/billing.constants';
import type { BillingLineItemDto } from '../../dto/billing.dto';
import { utcBillingMonth } from '../billing-period.util';

const QUANTITY_DECIMAL_PLACES = 9;
const QUANTITY_SCALE = decimalScale(QUANTITY_DECIMAL_PLACES);
const SNAPFLOW_PROVIDER = 'Snapflow';

const CATEGORY_EXPORT = {
	[BillingLineCategory.COMPUTE]: {
		description: 'Snapflow compute usage',
		unit: 'sandbox-hour',
		serviceCategory: 'Compute',
		serviceName: 'Snapflow Compute',
		serviceSubcategory: 'Virtual Machine',
		skuMeter: 'Sandbox Runtime',
	},
	[BillingLineCategory.STORAGE]: {
		description: 'Snapflow stopped sandbox disk',
		unit: 'stopped-sandbox-hour',
		serviceCategory: 'Storage',
		serviceName: 'Snapflow Storage',
		serviceSubcategory: 'Block Storage',
		skuMeter: 'Stopped Sandbox Disk',
	},
} as const satisfies Record<BillingLineCategory, Record<string, string>>;

export function billingExportRow(line: BillingLineItemDto): CsvRow {
	const billingPeriod = utcBillingMonth(line.periodStart);
	const charge = CATEGORY_EXPORT[line.category];
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
		x_SnapflowPlacementPriceId: line.placementPriceId ?? '',
		x_SnapflowQuantities: line.quantities
			? JSON.stringify(line.quantities)
			: '',
		x_SnapflowRawConsumedQuantities: JSON.stringify(line.consumedQuantities),
		x_SnapflowSchemaVersion: BILLING_EXPORT_SCHEMA_VERSION.toString(),
		x_SnapflowSourceId: line.sourceId,
		x_SnapflowSourceType: line.sourceType,
	};
}

function consumedQuantityOf(line: BillingLineItemDto): string {
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
