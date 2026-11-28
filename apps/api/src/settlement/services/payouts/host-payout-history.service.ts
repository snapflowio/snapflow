/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { type Address, getAddress, isAddressEqual } from 'viem';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import type {
	HostPayoutClaimDto,
	HostPayoutDto,
	HostPayoutPageDto,
	ListHostPayoutsQueryDto,
} from '../../dto/host-payout.dto';
import type { EscrowEvent } from '../../entities/escrow-event.entity';
import { organizationHostKeys } from '../../queries/host-keys.query';
import {
	hostPayoutClaims,
	hostPayoutPage,
	payoutRelayFees,
} from '../../queries/host-payouts.query';
import { microUsd } from '../../utils/escrow/escrow-amount.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';

const ZERO = 0n;

interface PayoutMachine {
	machineId: string;
	machineName: string;
}

function claimDto(claim: EscrowEvent): HostPayoutClaimDto {
	if (claim.channelId === null) {
		throw new Error(`Claim ${claim.id} has no payment channel`);
	}
	return {
		channelId: claim.channelId,
		amountMicroUsd: (
			microUsd(claim.args.paid) - microUsd(claim.args.fee)
		).toString(),
		claimedAt: claim.blockTimestamp,
		transactionHash: claim.transactionHash,
	};
}

function relayFeeOf(
	payout: EscrowEvent,
	host: Address,
	fees: readonly EscrowEvent[]
): bigint {
	const fee = fees.find(
		(event) =>
			event.transactionHash === payout.transactionHash &&
			isAddressEqual(getAddress(event.args.payer), host)
	);
	return fee ? microUsd(fee.args.amount) : ZERO;
}

@Injectable()
export class HostPayoutHistoryService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService
	) {}

	async list(
		organizationId: string,
		query: ListHostPayoutsQueryDto
	): Promise<HostPayoutPageDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const keys = await organizationHostKeys(manager, organizationId);
		const machineKeys = query.machineId
			? keys
					.filter(({ machineId }) => machineId === query.machineId)
					.map(({ address }) => address)
			: undefined;
		if (machineKeys?.length === 0) return { items: [], nextCursor: null };
		const page = await hostPayoutPage(manager, escrow, {
			organizationId,
			hostAddresses: machineKeys,
			from: query.from,
			to: query.to,
			cursor: query.cursor,
			limit: query.limit,
		});
		const [claims, fees] = await Promise.all([
			hostPayoutClaims(manager, escrow, page.items),
			payoutRelayFees(
				manager,
				escrow,
				page.items.map(({ transactionHash }) => transactionHash)
			),
		]);
		const machineByKey = new Map<Address, PayoutMachine>(
			keys.map((key) => [getAddress(key.address), key])
		);
		return {
			items: page.items.map((payout): HostPayoutDto => {
				const host = getAddress(payout.args.host);
				const machine = machineByKey.get(host);
				const net = microUsd(payout.args.amount);
				const fee = relayFeeOf(payout, host, fees);
				return {
					id: payout.id,
					machineId: machine?.machineId ?? null,
					machineName: machine?.machineName ?? null,
					hostAddress: host,
					payoutAddress: getAddress(payout.args.payout),
					grossMicroUsd: (net + fee).toString(),
					feeMicroUsd: fee.toString(),
					netMicroUsd: net.toString(),
					transactionHash: payout.transactionHash,
					blockNumber: payout.blockNumber,
					paidAt: payout.blockTimestamp,
					claims: (claims.get(payout.id) ?? []).map(claimDto),
				};
			}),
			nextCursor: page.nextCursor,
		};
	}
}
