/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../common/values/micro-usd.value';
import { SANDBOX_REPRICE_BACKOFF } from '../constants/sandbox-placement.constants';

export const PriceChangeAction = {
	REPRICE: 'reprice',
	ANNOUNCE: 'announce',
	WAIT: 'wait',
	STOP_ABOVE_MAXIMUM: 'stop_above_maximum',
	STOP_UNFIT: 'stop_unfit',
} as const;

export type PriceChangeAction =
	(typeof PriceChangeAction)[keyof typeof PriceChangeAction];

export interface PriceChangeFacts {
	running: boolean;
	fits: boolean;
	current: MicroUsd;
	next: MicroUsd;
	announced: MicroUsd | null;
	increaseDue: boolean;
	maximum: MicroUsd | null;
}

export function priceChangeAction(facts: PriceChangeFacts): PriceChangeAction {
	if (!facts.fits) {
		return facts.running
			? PriceChangeAction.STOP_UNFIT
			: PriceChangeAction.WAIT;
	}
	if (!facts.running || facts.next.atMost(facts.current)) {
		return PriceChangeAction.REPRICE;
	}
	if (facts.announced === null || facts.next.greaterThan(facts.announced)) {
		return PriceChangeAction.ANNOUNCE;
	}
	if (!facts.increaseDue) return PriceChangeAction.WAIT;
	return facts.maximum !== null && facts.next.greaterThan(facts.maximum)
		? PriceChangeAction.STOP_ABOVE_MAXIMUM
		: PriceChangeAction.REPRICE;
}

export function repriceRetryDelayMilliseconds(attempts: number): number {
	return Math.min(
		SANDBOX_REPRICE_BACKOFF.capMilliseconds,
		SANDBOX_REPRICE_BACKOFF.baseMilliseconds * 2 ** Math.max(0, attempts - 1)
	);
}

export function hasNewerCard(
	priceCardId: string | null,
	currentPriceCardId: string | null
): boolean {
	return (
		priceCardId !== null &&
		currentPriceCardId !== null &&
		currentPriceCardId !== priceCardId
	);
}
