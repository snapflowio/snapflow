/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	refillSignerBudget,
	type SignerBudget,
	signerAvailableAt,
} from '@snapflow/contracts';
import type { EscrowSigner } from '../../entities/escrow-signer.entity';
import { chainSeconds, microUsd } from './escrow-amount.util';
import { chainTimestamp } from './escrow-event-record.util';

export type StoredSignerBudget = Pick<
	EscrowSigner,
	| 'hourlyCap'
	| 'pendingHourlyCap'
	| 'pendingEffectiveAt'
	| 'available'
	| 'remainder'
	| 'budgetUpdatedAt'
>;

const NO_PENDING_EFFECTIVE_AT = 0n;

export function signerBudgetOf(stored: StoredSignerBudget): SignerBudget {
	return {
		hourlyCap: microUsd(stored.hourlyCap),
		pendingHourlyCap: microUsd(stored.pendingHourlyCap),
		pendingEffectiveAt:
			stored.pendingEffectiveAt === null
				? NO_PENDING_EFFECTIVE_AT
				: chainSeconds(stored.pendingEffectiveAt),
		available: microUsd(stored.available),
		remainder: stored.remainder,
		updatedAt: chainSeconds(stored.budgetUpdatedAt),
	};
}

export function storedSignerBudget(budget: SignerBudget): StoredSignerBudget {
	return {
		hourlyCap: budget.hourlyCap.toString(),
		pendingHourlyCap: budget.pendingHourlyCap.toString(),
		pendingEffectiveAt:
			budget.pendingEffectiveAt === NO_PENDING_EFFECTIVE_AT
				? null
				: chainTimestamp(budget.pendingEffectiveAt),
		available: budget.available.toString(),
		remainder: budget.remainder,
		budgetUpdatedAt: chainTimestamp(budget.updatedAt),
	};
}

export function grantedSignerBudget(
	hourlyCap: bigint,
	unfrozenAt: bigint
): StoredSignerBudget {
	return storedSignerBudget({
		hourlyCap,
		pendingHourlyCap: 0n,
		pendingEffectiveAt: NO_PENDING_EFFECTIVE_AT,
		available: 0n,
		remainder: 0,
		updatedAt: unfrozenAt,
	});
}

export function signerAvailableNow(
	stored: StoredSignerBudget,
	now: bigint
): bigint {
	return signerAvailableAt(signerBudgetOf(stored), now);
}

export function signerHourlyCapNow(
	stored: StoredSignerBudget,
	now: bigint
): bigint {
	return refillSignerBudget(signerBudgetOf(stored), now).hourlyCap;
}

export function chargedSignerBudget(
	stored: StoredSignerBudget,
	paid: bigint,
	unfrozenAt: bigint
): StoredSignerBudget {
	const refilled = refillSignerBudget(signerBudgetOf(stored), unfrozenAt);
	if (paid > refilled.available) {
		throw new Error(
			`A claim paid ${paid} through a signer with ${refilled.available} available`
		);
	}
	return storedSignerBudget({
		...refilled,
		available: refilled.available - paid,
	});
}

export function raisedSignerBudget(
	stored: StoredSignerBudget,
	hourlyCap: bigint,
	unfrozenAt: bigint
): StoredSignerBudget {
	return storedSignerBudget({
		...refillSignerBudget(signerBudgetOf(stored), unfrozenAt),
		hourlyCap,
		pendingHourlyCap: 0n,
		pendingEffectiveAt: NO_PENDING_EFFECTIVE_AT,
	});
}

export function loweringScheduledSignerBudget(
	stored: StoredSignerBudget,
	hourlyCap: bigint,
	effectiveAt: bigint,
	unfrozenAt: bigint
): StoredSignerBudget {
	return storedSignerBudget({
		...refillSignerBudget(signerBudgetOf(stored), unfrozenAt),
		pendingHourlyCap: hourlyCap,
		pendingEffectiveAt: effectiveAt,
	});
}
