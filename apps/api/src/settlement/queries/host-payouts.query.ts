/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Address, Hash } from 'viem';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { createRangeFilter } from '../../common/utils/pagination/range-filter.util';
import {
	CLAIMED_EVENT,
	HOST_WITHDRAWN_EVENT,
	RELAY_FEE_PAID_EVENT,
} from '../constants/escrow.constants';
import { EscrowEvent } from '../entities/escrow-event.entity';
import type { EscrowIdentity } from '../types/escrow.types';

export interface HostPayoutFilter {
	organizationId: string;
	hostAddresses?: readonly Address[];
	from?: Date;
	to?: Date;
	cursor?: string;
	limit: number;
}

interface PayoutClaimRow {
	payoutId: string;
	claimId: string;
}

export function hostPayoutPage(
	manager: EntityManager,
	escrow: EscrowIdentity,
	filter: HostPayoutFilter
): Promise<CursorPage<EscrowEvent>> {
	const paidAt = createRangeFilter(filter.from, filter.to);
	return findCursorPage(manager, EscrowEvent, {
		where: {
			...escrow,
			kind: HOST_WITHDRAWN_EVENT,
			hostOrganizationId: filter.organizationId,
			...(filter.hostAddresses
				? { hostAddress: { $in: [...filter.hostAddresses] } }
				: {}),
			...(paidAt ? { blockTimestamp: paidAt } : {}),
		},
		orderBy: { blockNumber: QueryOrder.DESC, logIndex: QueryOrder.DESC },
		cursor: filter.cursor,
		limit: filter.limit,
	});
}

export async function hostPayoutClaims(
	manager: EntityManager,
	escrow: EscrowIdentity,
	payouts: readonly Pick<EscrowEvent, 'id' | 'hostAddress'>[]
): Promise<Map<string, EscrowEvent[]>> {
	const claims = new Map<string, EscrowEvent[]>();
	const hosts = [
		...new Set(payouts.flatMap(({ hostAddress }) => hostAddress ?? [])),
	];
	if (hosts.length === 0) return claims;
	const rows = await manager.execute<PayoutClaimRow[]>(
		`WITH payout AS (
			SELECT id, "hostAddress", "blockNumber", "logIndex",
				lag("blockNumber") OVER host_order AS "previousBlockNumber",
				lag("logIndex") OVER host_order AS "previousLogIndex"
			FROM escrow_event
			WHERE "chainId" = ? AND "contractAddress" = ? AND kind = ?
				AND "hostAddress" IN (?)
			WINDOW host_order AS (
				PARTITION BY "hostAddress" ORDER BY "blockNumber", "logIndex"
			)
		)
		SELECT payout.id AS "payoutId", claim.id AS "claimId"
		FROM payout
		JOIN escrow_event claim
			ON claim."chainId" = ? AND claim."contractAddress" = ? AND claim.kind = ?
			AND claim."hostAddress" = payout."hostAddress"
			AND (claim."blockNumber", claim."logIndex")
				< (payout."blockNumber", payout."logIndex")
			AND (
				payout."previousBlockNumber" IS NULL
				OR (claim."blockNumber", claim."logIndex")
					> (payout."previousBlockNumber", payout."previousLogIndex")
			)
		WHERE payout.id IN (?)
		ORDER BY claim."blockNumber", claim."logIndex"`,
		[
			escrow.chainId,
			escrow.contractAddress,
			HOST_WITHDRAWN_EVENT,
			hosts,
			escrow.chainId,
			escrow.contractAddress,
			CLAIMED_EVENT,
			payouts.map(({ id }) => id),
		]
	);
	if (rows.length === 0) return claims;
	const events = await manager.find(EscrowEvent, {
		id: { $in: rows.map(({ claimId }) => claimId) },
	});
	const eventById = new Map(events.map((event) => [event.id, event]));
	for (const { payoutId, claimId } of rows) {
		const event = eventById.get(claimId);
		if (!event) throw new Error(`Escrow event ${claimId} no longer exists`);
		claims.set(payoutId, [...(claims.get(payoutId) ?? []), event]);
	}
	return claims;
}

export function payoutRelayFees(
	manager: EntityManager,
	escrow: EscrowIdentity,
	transactionHashes: readonly Hash[]
): Promise<EscrowEvent[]> {
	if (transactionHashes.length === 0) return Promise.resolve([]);
	return manager.find(EscrowEvent, {
		...escrow,
		kind: RELAY_FEE_PAID_EVENT,
		transactionHash: { $in: [...new Set(transactionHashes)] },
	});
}
