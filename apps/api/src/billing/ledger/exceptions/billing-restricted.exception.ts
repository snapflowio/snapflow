/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ConflictException } from '@nestjs/common';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import { BILLING_RESTRICTION_MESSAGES } from '../constants/billing-admission.constants';
import type { BillingRestriction } from '../enums/billing-restriction.enum';

export interface BillingRestrictionFunding {
	requiredMicroUsd: MicroUsd;
	availableMicroUsd: MicroUsd;
}

export class BillingRestrictedException extends ConflictException {
	constructor(
		readonly restriction: BillingRestriction,
		funding: BillingRestrictionFunding
	) {
		super({
			code: restriction,
			message: BILLING_RESTRICTION_MESSAGES[restriction],
			requiredMicroUsd: funding.requiredMicroUsd.toString(),
			availableMicroUsd: funding.availableMicroUsd.toString(),
		});
	}
}
