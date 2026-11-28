/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { EscrowClaimsFreeze } from '../entities/escrow-claims-freeze.entity';
import type { EscrowIdentity } from '../types/escrow.types';
import {
	claimsFrozenAt,
	unfrozenSecondsAt,
} from '../utils/escrow/claims-freeze.util';

export interface EscrowUnfrozenClock {
	unfrozenSeconds: bigint;
	frozen: boolean;
}

function claimsFreeze(
	manager: EntityManager,
	escrow: EscrowIdentity
): Promise<EscrowClaimsFreeze | null> {
	return manager.findOne(EscrowClaimsFreeze, {
		chainId: escrow.chainId,
		contractAddress: escrow.contractAddress,
	});
}

export async function escrowUnfrozenSeconds(
	manager: EntityManager,
	escrow: EscrowIdentity,
	at: Date
): Promise<bigint> {
	return unfrozenSecondsAt(await claimsFreeze(manager, escrow), at);
}

export async function escrowUnfrozenClock(
	manager: EntityManager,
	escrow: EscrowIdentity,
	at: Date
): Promise<EscrowUnfrozenClock> {
	const freeze = await claimsFreeze(manager, escrow);
	return {
		unfrozenSeconds: unfrozenSecondsAt(freeze, at),
		frozen: claimsFrozenAt(freeze, at),
	};
}
