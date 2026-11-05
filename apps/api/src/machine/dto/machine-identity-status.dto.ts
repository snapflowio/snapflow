/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { PayoutReadiness } from '../../payments/enums/payout-readiness.enum';
import { MachineFullDto } from './machine-full.dto';

@ApiSchema({ name: 'MachineIdentityStatus' })
export class MachineIdentityStatusDto extends MachineFullDto {
	@ApiProperty({
		description:
			'Whether the organization that owns the machine can receive payouts of its earnings',
		enum: PayoutReadiness,
		enumName: 'PayoutReadiness',
		example: PayoutReadiness.READY,
	})
	payouts: PayoutReadiness;
}
