/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Address } from 'viem';
import { Machine } from '../../machine/entities/machine.entity';
import type { PaymentChannel } from '../entities/payment-channel.entity';
import type { EscrowIdentity } from '../types/escrow.types';
import { microUsd } from '../utils/escrow/escrow-amount.util';
import { isSignerCapped } from '../utils/payouts/payout-due.util';
import { earliestClaimDeadline } from './claim-deadline.query';
import { latestVouchers, VoucherSelection } from './latest-vouchers.query';

export interface HostPayoutSchedule {
	claimDeadlineAt: Date | null;
	owedChannels: number;
	draining: boolean;
	signerCapped: boolean;
}

interface ScheduledKey {
	address: Address;
	machineId: string;
}

interface ScheduleInput {
	keys: readonly ScheduledKey[];
	channels: readonly PaymentChannel[];
}

export async function hostPayoutSchedules(
	manager: EntityManager,
	escrow: EscrowIdentity,
	input: ScheduleInput
): Promise<Map<Address, HostPayoutSchedule>> {
	const owed = input.channels.filter(
		(channel) =>
			microUsd(channel.signedMicroUsd) > microUsd(channel.claimedMicroUsd)
	);
	const signed = await latestVouchers(
		manager,
		owed.map(({ id }) => id),
		VoucherSelection.SIGNED
	);
	const draining = await drainingMachines(
		manager,
		input.keys.map(({ machineId }) => machineId)
	);
	const schedules = new Map<Address, HostPayoutSchedule>();
	for (const key of input.keys) {
		const channels = owed.filter(
			({ hostAddress }) => hostAddress === key.address
		);
		schedules.set(key.address, {
			claimDeadlineAt: await earliestClaimDeadline(
				manager,
				escrow,
				channels.flatMap(({ id }) => {
					const voucher = signed.get(id);
					return voucher ? [voucher.id] : [];
				})
			),
			owedChannels: channels.length,
			draining: draining.has(key.machineId),
			signerCapped: channels.some(isSignerCapped),
		});
	}
	return schedules;
}

async function drainingMachines(
	manager: EntityManager,
	machineIds: readonly string[]
): Promise<Set<string>> {
	if (machineIds.length === 0) return new Set();
	const machines = await manager.find(
		Machine,
		{ id: { $in: [...new Set(machineIds)] }, draining: true },
		{ fields: ['id'] }
	);
	return new Set(machines.map(({ id }) => id));
}
