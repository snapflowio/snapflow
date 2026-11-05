/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { SandboxListItemDto } from './sandbox-list-item.dto';

@ApiSchema({ name: 'ListSandboxesResponse' })
export class ListSandboxesResponseDto {
	@ApiProperty({
		description: 'List of results for the current page',
		type: [SandboxListItemDto],
	})
	items: SandboxListItemDto[];

	@ApiProperty({
		description: 'Cursor for the next page of results',
		type: String,
		nullable: true,
	})
	nextCursor: string | null;
}
