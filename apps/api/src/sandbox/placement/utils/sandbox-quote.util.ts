/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BillingRestriction } from '../../../billing/ledger/enums/billing-restriction.enum';
import { HOURS_PER_DAY } from '../../../common/constants/time.constants';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import type { ResourceShapeFields } from '../../../common/values/resource-shape.value';
import { HOURS_PER_BILLING_MONTH } from '../../../marketplace/machine/constants/pricing.constants';
import type { MachineUnavailableReason } from '../../../marketplace/machine/enums/machine-unavailable-reason.enum';
import type { PlacementKind } from '../../../marketplace/machine/enums/placement-kind.enum';
import type { PriceTerms } from '../../../marketplace/machine/types/pricing.types';
import {
	runningHourlyPrice,
	stoppedHourlyPrice,
} from '../../../marketplace/machine/utils/pricing.util';
import type { SandboxQuoteDto } from '../../instance/dto/sandbox-quote.dto';

export interface QuotedMachine {
	machineId: string;
	priceCardId: string | null;
}

export interface QuoteContext {
	placementKind: PlacementKind;
	eligibleMachineCount: number;
	priceLockDays: number;
	minimumFundingMicroUsd: MicroUsd;
	machine?: QuotedMachine;
	unavailableReason?: MachineUnavailableReason;
	billingRestriction?: BillingRestriction;
}

export function sandboxQuote(
	terms: PriceTerms,
	shape: ResourceShapeFields,
	context: QuoteContext
): SandboxQuoteDto {
	const hourly = runningHourlyPrice(terms, shape);
	return {
		placementKind: context.placementKind,
		available:
			context.unavailableReason === undefined &&
			context.billingRestriction === undefined,
		unavailableReason: context.unavailableReason,
		billingRestriction: context.billingRestriction,
		eligibleMachineCount: context.eligibleMachineCount,
		machineId: context.machine?.machineId,
		priceCardId: context.machine?.priceCardId ?? undefined,
		hourlyPriceMicroUsd: hourly.grossMicroUsd.toString(),
		hostHourlyMicroUsd: hourly.hostMicroUsd.toString(),
		markupHourlyMicroUsd: hourly.markupMicroUsd.toString(),
		markupBasisPoints: terms.markupBasisPoints.toNumber(),
		stoppedHourlyPriceMicroUsd: stoppedHourlyPrice(
			terms,
			shape
		).grossMicroUsd.toString(),
		dailyPriceMicroUsd: hourly.grossMicroUsd
			.multiply(BigInt(HOURS_PER_DAY))
			.toString(),
		monthlyPriceMicroUsd: hourly.grossMicroUsd
			.multiply(HOURS_PER_BILLING_MONTH)
			.toString(),
		minimumFundingMicroUsd: context.minimumFundingMicroUsd.toString(),
		priceLockDays: context.priceLockDays,
	};
}
