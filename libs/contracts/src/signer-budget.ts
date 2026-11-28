/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SignerGrant } from './escrow-types.js';
import { SECONDS_PER_HOUR, SIGNER_BURST_HOURS } from './limits.js';

export type SignerBudget = Pick<
	SignerGrant,
	| 'hourlyCap'
	| 'pendingHourlyCap'
	| 'pendingEffectiveAt'
	| 'available'
	| 'remainder'
	| 'updatedAt'
>;

export function signerBudgetCapacity(hourlyCap: bigint): bigint {
	return hourlyCap * SIGNER_BURST_HOURS;
}

export function refillSignerBudget<Budget extends SignerBudget>(
	budget: Budget,
	now: bigint
): Budget {
	if (now < budget.updatedAt) return budget;
	const effectiveAt = budget.pendingEffectiveAt;
	if (effectiveAt !== 0n && effectiveAt <= now) {
		return accrue(
			{
				...accrue(budget, effectiveAt),
				hourlyCap: budget.pendingHourlyCap,
				pendingHourlyCap: 0n,
				pendingEffectiveAt: 0n,
			},
			now
		);
	}
	return accrue(budget, now);
}

export function signerAvailableAt(budget: SignerBudget, now: bigint): bigint {
	return refillSignerBudget(budget, now).available;
}

function accrue<Budget extends SignerBudget>(
	budget: Budget,
	until: bigint
): Budget {
	const accrued =
		BigInt(budget.remainder) + (until - budget.updatedAt) * budget.hourlyCap;
	const available = budget.available + accrued / SECONDS_PER_HOUR;
	const full = signerBudgetCapacity(budget.hourlyCap);
	if (available >= full) {
		return { ...budget, available: full, remainder: 0, updatedAt: until };
	}
	return {
		...budget,
		available,
		remainder: Number(accrued % SECONDS_PER_HOUR),
		updatedAt: until,
	};
}
