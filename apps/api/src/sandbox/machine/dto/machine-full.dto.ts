/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { CursorPageDto } from '../../../common/dto/cursor-page.dto';
import { MachineMarketplaceStatusDto } from '../../../marketplace/dto/machine.dto';
import { Machine } from '../entities/machine.entity';
import { MachineDto } from './machine.dto';

@ApiSchema({ name: 'MachineFull' })
export class MachineFullDto extends MachineDto {
	@ApiProperty({
		description:
			'Marketplace tier and listing state of the machine; null before the machine exists',
		type: MachineMarketplaceStatusDto,
		nullable: true,
	})
	marketplace: MachineMarketplaceStatusDto | null;

	static fromMachineStatus(
		machine: Machine,
		marketplace: MachineMarketplaceStatusDto | null
	): MachineFullDto {
		return {
			...MachineDto.from(machine),
			marketplace,
		};
	}
}

@ApiSchema({ name: 'MachineFullPage' })
export class MachineFullPageDto extends CursorPageDto<MachineFullDto> {
	@ApiProperty({ type: MachineFullDto, isArray: true })
	declare items: MachineFullDto[];
}
