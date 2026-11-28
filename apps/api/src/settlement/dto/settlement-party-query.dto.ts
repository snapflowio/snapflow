/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CursorPageQueryDto } from '../../common/dto/cursor-page.dto';
import { SETTLEMENT_PARTIES } from '../constants/settlement.constants';
import { SettlementParty } from '../enums/settlement-party.enum';

export abstract class SettlementPartyPageQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({
		enum: SettlementParty,
		enumName: 'SettlementParty',
		description:
			'Only where the organization took this part: customer needs billing:read and host payouts:read; omitted, every part the caller may read',
	})
	@IsOptional()
	@IsIn(SETTLEMENT_PARTIES)
	role?: SettlementParty;
}
