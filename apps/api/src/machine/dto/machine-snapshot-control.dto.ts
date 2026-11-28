/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { MACHINE_SNAPSHOT_INVENTORY_LIMITS } from '../constants/machine-snapshot.constants';

export class MachineSnapshotInventoryReportDto {
	@ApiProperty({
		description: 'Proto3 JSON of machine.v1alpha1.MachineSnapshotInventory',
		maxLength: MACHINE_SNAPSHOT_INVENTORY_LIMITS.maximumDocumentLength,
	})
	@IsString()
	@MaxLength(MACHINE_SNAPSHOT_INVENTORY_LIMITS.maximumDocumentLength)
	inventory: string;
}

export class MachineSnapshotRegistryCredentialsDto {
	@ApiProperty({
		description: 'Proto3 JSON of machine.v1alpha1.SnapshotRegistryCredentials',
	})
	credentials: string;
}
