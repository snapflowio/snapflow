/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Address, Hash, Hex } from 'viem';
import type { HostSettlementItem } from './host-settlement.types';

export interface OperatorCall {
	to: Address;
	data: Hex;
	gas?: bigint;
}

export interface ClaimBatchCall {
	call: Required<OperatorCall>;
	paid: bigint;
}

export interface OperatorTransactionSubject {
	hostAddress?: Address;
	walletTransactionId?: string;
	hostSettlementId?: string;
	claims?: readonly HostSettlementItem[];
}

export type MarkSent = (manager: EntityManager, hash: Hash) => Promise<void>;
