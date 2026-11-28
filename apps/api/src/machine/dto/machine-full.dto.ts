/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import { MachineMarketplaceStatusDto } from '../../marketplace/dto/machine.dto';
import { Machine } from '../entities/machine.entity';
import { MachineEnrollmentPhase } from '../enums/machine-enrollment-phase.enum';
import { machineEnrollmentPhase } from '../utils/enrollment/machine-enrollment-phase.util';
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

	@ApiProperty({
		description:
			'Where the machine is on its way to the marketplace: connecting, connected, benchmarking, awaiting_approval, ready_to_list and listed in order; benchmark_deferred while a deferred benchmark waits for its automatic retry; or a failure such as benchmark_failed or benchmark_expired',
		enum: MachineEnrollmentPhase,
		enumName: 'MachineEnrollmentPhase',
	})
	enrollmentPhase: MachineEnrollmentPhase;

	static fromMachineStatus(
		machine: Machine,
		marketplace: MachineMarketplaceStatusDto | null
	): MachineFullDto {
		return {
			...MachineDto.from(machine),
			marketplace,
			enrollmentPhase: machineEnrollmentPhase(machine, marketplace),
		};
	}
}

@ApiSchema({ name: 'MachineFullPage' })
export class MachineFullPageDto extends CursorPageDto<MachineFullDto> {
	@ApiProperty({ type: MachineFullDto, isArray: true })
	declare items: MachineFullDto[];
}
