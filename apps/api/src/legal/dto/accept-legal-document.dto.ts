/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString } from 'class-validator';

@ApiSchema({ name: 'AcceptLegalDocument' })
export class AcceptLegalDocumentDto {
	@ApiProperty({
		description:
			'The version being accepted; it must be the current one from the public configuration',
		example: '2026-11-12',
	})
	@IsString()
	version: string;
}
