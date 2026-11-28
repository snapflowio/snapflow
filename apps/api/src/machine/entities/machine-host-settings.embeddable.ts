/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Embeddable, Property } from '@mikro-orm/decorators/legacy';
import { amountColumn } from '../../settlement/utils/settlement-columns.util';
import { MACHINE_OPTIONAL_INTEGER_COLUMN } from './machine.columns';

@Embeddable()
export class MachineHostSettings {
	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'maintenanceWindowStartMinute',
	})
	maintenanceWindowStartMinute: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'maintenanceWindowDurationMinutes',
	})
	maintenanceWindowDurationMinutes: number | null = null;

	@Property({ ...MACHINE_OPTIONAL_INTEGER_COLUMN, fieldName: 'offeredVcpus' })
	offeredVcpus: number | null = null;

	@Property({
		...MACHINE_OPTIONAL_INTEGER_COLUMN,
		fieldName: 'offeredMemoryGib',
	})
	offeredMemoryGib: number | null = null;

	@Property({ ...MACHINE_OPTIONAL_INTEGER_COLUMN, fieldName: 'offeredDiskGib' })
	offeredDiskGib: number | null = null;

	@Property({ ...amountColumn('maxUnclaimedFloat'), nullable: true })
	maxUnclaimedFloat: string | null = null;
}
