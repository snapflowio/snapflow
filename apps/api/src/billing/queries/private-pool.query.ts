/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { ListingState } from '../../marketplace/enums/listing-state.enum';
import { ListingVisibility } from '../../marketplace/enums/listing-visibility.enum';

export interface PrivatePoolMachine {
	machineId: string;
	organizationId: string;
}

// The private pool: machines their organization listed for its own use only
// (a listed listing with private visibility) that are not decommissioned.
// A paused or draft listing takes no sandboxes, and a public listing earns
// its host money instead, so neither is in the pool. Lists the pool machines
// not charged for serviceDay yet.
export function unchargedPrivatePoolMachines(
	manager: EntityManager,
	serviceDay: Date
): Promise<PrivatePoolMachine[]> {
	return manager.execute<PrivatePoolMachine[]>(
		`SELECT machine.id AS "machineId", machine."organizationId"
		 FROM machine
		 JOIN machine_listing listing ON listing."machineId" = machine.id
		 JOIN organization ON organization.id = machine."organizationId"
		 WHERE listing.state = ? AND listing.visibility = ?
		   AND machine.state <> ?
		   AND organization."deletedAt" IS NULL
		   AND NOT EXISTS (
			 SELECT 1 FROM private_pool_charge charge
			 WHERE charge."machineId" = machine.id AND charge."serviceDay" = ?
		   )
		 ORDER BY machine.id`,
		[
			ListingState.LISTED,
			ListingVisibility.PRIVATE,
			MachineState.DECOMMISSIONED,
			serviceDay,
		]
	);
}
