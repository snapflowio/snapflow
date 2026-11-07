/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { SETTLEMENT_ESCROW_LOCK_NAMESPACE } from '../../common/constants/advisory-lock.constants';
import { lockAdvisoryKey } from '../../infra/database/utils/advisory-lock.util';
import type { EscrowIdentity } from '../types/escrow.types';

// Serializes indexing batches with wallet links: whichever commits second
// sees the other's rows, so an event is never stored unattributed after its
// wallet was linked.
export function lockEscrow(
	manager: EntityManager,
	escrow: EscrowIdentity
): Promise<void> {
	return lockAdvisoryKey(
		manager,
		`${escrow.chainId}:${escrow.contractAddress}`,
		SETTLEMENT_ESCROW_LOCK_NAMESPACE
	);
}
