/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'BuildInfo' })
export class BuildInfoDto {
	@ApiPropertyOptional({
		description: 'The Dockerfile content used for the build',
		example:
			'FROM node:14\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["npm", "start"]',
	})
	dockerfileContent?: string;

	@ApiPropertyOptional({
		description: 'The context hashes used for the build',
		type: [String],
		example: ['hash1', 'hash2'],
	})
	contextHashes?: string[];

	@ApiProperty({
		description: 'The creation timestamp',
	})
	createdAt: Date;

	@ApiProperty({
		description: 'The last update timestamp',
	})
	updatedAt: Date;

	@ApiProperty({
		description: 'The snapshot reference',
		example: 'snapflowio/sandbox:latest',
	})
	snapshotRef: string;
}
