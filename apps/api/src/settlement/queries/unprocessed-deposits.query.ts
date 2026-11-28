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
import { DEPOSITED_EVENT } from '../constants/escrow.constants';
import { EscrowEvent } from '../entities/escrow-event.entity';
import type { EscrowIdentity } from '../types/escrow.types';

export function unprocessedDeposits(
	manager: EntityManager,
	escrow: EscrowIdentity,
	organizationId: string
): Promise<EscrowEvent[]> {
	return manager.find(
		EscrowEvent,
		{
			...escrow,
			kind: DEPOSITED_EVENT,
			processedAt: null,
			customerOrganizationId: organizationId,
		},
		{
			orderBy: { blockNumber: QueryOrder.DESC, logIndex: QueryOrder.DESC },
		}
	);
}
