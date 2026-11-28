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
import { DelegatedSigner } from '../entities/delegated-signer.entity';
import type { EscrowIdentity } from '../types/escrow.types';

export function activeDelegatedSigner(
	manager: EntityManager,
	escrow: EscrowIdentity,
	customerAddress: Address
): Promise<DelegatedSigner | null> {
	return manager.findOne(DelegatedSigner, {
		chainId: escrow.chainId,
		contractAddress: escrow.contractAddress,
		customerAddress,
		retiredAt: null,
	});
}
