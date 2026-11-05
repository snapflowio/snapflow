/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';

export class RegistryPushAccessDto {
	@ApiProperty({
		description: 'Temporary username for registry authentication',
		example: 'snapflow-token',
	})
	username: string;

	@ApiProperty({
		description: 'Temporary secret for registry authentication',
		example: 'eyJhbGciOiJIUzI1NiIs...',
	})
	secret: string;

	@ApiProperty({
		description: 'Registry URL',
		example: 'registry.example.com',
	})
	registryUrl: string;

	@ApiProperty({
		description: 'Registry ID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	registryId: string;

	@ApiProperty({
		description:
			'Repository namespace the credentials can push to (push images as <registryUrl>/<project>/<name>:<tag>)',
		example: 'transient/123e4567-e89b-12d3-a456-426614174000',
	})
	project: string;

	@ApiProperty({
		description: 'Token expiration time in ISO format',
		example: '2023-12-31T23:59:59Z',
	})
	expiresAt: string;
}
