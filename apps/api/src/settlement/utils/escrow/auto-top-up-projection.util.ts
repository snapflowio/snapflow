/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { EscrowAutoTopUp } from '../../entities/escrow-auto-top-up.entity';
import type { EscrowIdentity, EscrowLogOf } from '../../types/escrow.types';

export async function projectAutoTopUpSet(
	manager: EntityManager,
	escrow: EscrowIdentity,
	log: EscrowLogOf<'AutoTopUpSet'>
): Promise<void> {
	const { customer, relayer, amount, threshold, maxRelayFee, minInterval } =
		log.args;
	const limits = {
		relayerAddress: relayer,
		amountMicroUsd: amount.toString(),
		thresholdMicroUsd: threshold.toString(),
		maxRelayFeeMicroUsd: maxRelayFee.toString(),
		minIntervalSeconds: minInterval,
	};
	const existing = await manager.findOne(EscrowAutoTopUp, {
		...escrow,
		customerAddress: customer,
	});
	if (existing) {
		manager.assign(existing, limits);
		return;
	}
	manager.create(EscrowAutoTopUp, {
		...escrow,
		customerAddress: customer,
		...limits,
	});
	await manager.flush();
}

export async function projectAutoTopUpDisabled(
	manager: EntityManager,
	escrow: EscrowIdentity,
	log: EscrowLogOf<'AutoTopUpDisabled'>
): Promise<void> {
	await manager.nativeDelete(EscrowAutoTopUp, {
		...escrow,
		customerAddress: log.args.customer,
	});
}

export async function projectAutoTopUpExecuted(
	manager: EntityManager,
	escrow: EscrowIdentity,
	log: EscrowLogOf<'AutoTopUpExecuted'>,
	blockTimestamp: Date
): Promise<void> {
	const { customer } = log.args;
	const config = await manager.findOne(EscrowAutoTopUp, {
		...escrow,
		customerAddress: customer,
	});
	if (!config) {
		throw new Error(`Auto top-up of ${customer} ran without being set`);
	}
	config.lastTopUpAt = blockTimestamp;
}
