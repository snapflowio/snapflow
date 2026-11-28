/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Address, isAddressEqual } from 'viem';
import { SECONDS_PER_DAY } from '../../../common/constants/time.constants';
import { addSeconds } from '../../../common/utils/time.util';
import { AutoTopUpStatus } from '../../constants/auto-top-up.constants';
import type { AutoTopUp } from '../../entities/auto-top-up.entity';
import type { EscrowAccount } from '../../entities/escrow-account.entity';
import type { EscrowAutoTopUp } from '../../entities/escrow-auto-top-up.entity';
import { microUsd } from '../escrow/escrow-amount.util';

export type AutoTopUpLimits = Pick<
	EscrowAutoTopUp,
	| 'relayerAddress'
	| 'amountMicroUsd'
	| 'thresholdMicroUsd'
	| 'maxRelayFeeMicroUsd'
	| 'minIntervalSeconds'
	| 'lastTopUpAt'
>;

export function authorizesRelayer(
	limits: Pick<AutoTopUpLimits, 'relayerAddress'> | null,
	relayer: Address
): limits is AutoTopUpLimits {
	return limits !== null && isAddressEqual(limits.relayerAddress, relayer);
}

export function autoTopUpStatus(
	settings: Pick<AutoTopUp, 'enabled' | 'lastFailedAt'> | null,
	limits: Pick<AutoTopUpLimits, 'relayerAddress'> | null,
	relayer: Address
): AutoTopUpStatus {
	if (!settings?.enabled) return AutoTopUpStatus.DISABLED;
	if (!authorizesRelayer(limits, relayer))
		return AutoTopUpStatus.NOT_AUTHORIZED;
	return settings.lastFailedAt === null
		? AutoTopUpStatus.ACTIVE
		: AutoTopUpStatus.FAILING;
}

export function nextTopUpAt(limits: AutoTopUpLimits): Date | null {
	return limits.lastTopUpAt === null
		? null
		: addSeconds(limits.lastTopUpAt, limits.minIntervalSeconds);
}

export function autoTopUpDue(
	limits: AutoTopUpLimits,
	account: Pick<EscrowAccount, 'freeMicroUsd' | 'pendingMicroUsd'> | null,
	now: Date
): boolean {
	const next = nextTopUpAt(limits);
	if (next !== null && now < next) return false;
	const available = account
		? microUsd(account.freeMicroUsd) + microUsd(account.pendingMicroUsd)
		: 0n;
	return available < microUsd(limits.thresholdMicroUsd);
}

export function autoTopUpMinInterval(timesPerDay: number): number {
	return Math.floor(SECONDS_PER_DAY / timesPerDay);
}

export function autoTopUpInSync(
	settings: Pick<
		AutoTopUp,
		| 'amountMicroUsd'
		| 'thresholdMicroUsd'
		| 'maxRelayFeeMicroUsd'
		| 'timesPerDay'
	>,
	limits: AutoTopUpLimits,
	relayer: Address
): boolean {
	return (
		authorizesRelayer(limits, relayer) &&
		microUsd(settings.amountMicroUsd) === microUsd(limits.amountMicroUsd) &&
		microUsd(settings.maxRelayFeeMicroUsd) ===
			microUsd(limits.maxRelayFeeMicroUsd) &&
		microUsd(settings.thresholdMicroUsd) ===
			microUsd(limits.thresholdMicroUsd) &&
		autoTopUpMinInterval(settings.timesPerDay) === limits.minIntervalSeconds
	);
}
