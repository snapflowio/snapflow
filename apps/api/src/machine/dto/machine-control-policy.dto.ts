/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';

export class MachineControlPolicyDto {
	@ApiProperty({ type: 'integer', minimum: 1 })
	schemaVersion: number;

	@ApiProperty({ type: 'integer', minimum: 1 })
	revision: number;

	@ApiProperty({ format: 'date-time' })
	issuedAt: string;

	@ApiProperty({ format: 'date-time' })
	expiresAt: string;

	@ApiProperty({ format: 'uri' })
	guestRegistryUrl: string;

	@ApiProperty()
	desktopEnabled: boolean;

	@ApiProperty()
	serialConsoleEnabled: boolean;

	@ApiProperty({
		description:
			'Machine-scoped connection capability; it does not authorize the control-plane API',
	})
	connectionToken: string;
}
