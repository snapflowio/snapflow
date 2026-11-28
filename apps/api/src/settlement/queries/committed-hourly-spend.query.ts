/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { PlacementBillingAuthorization } from '../../billing/entities/placement-billing-authorization.entity';
import { microUsd } from '../utils/escrow/escrow-amount.util';

export async function committedHourlySpend(
	manager: EntityManager,
	organizationId: string
): Promise<bigint> {
	const authorizations = await manager.find(
		PlacementBillingAuthorization,
		{ customerOrganizationId: organizationId, releasedAt: null },
		{ fields: ['estimatedHourlyMicroUsd'] }
	);
	return authorizations.reduce(
		(total, { estimatedHourlyMicroUsd }) =>
			total + microUsd(estimatedHourlyMicroUsd),
		0n
	);
}
