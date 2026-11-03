/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';

export class StorageAccessDto {
	@ApiProperty({
		description: 'Access key for storage authentication',
		example: 'temp-user-123',
	})
	accessKey: string;

	@ApiProperty({
		description: 'Secret key for storage authentication',
		example: 'abchbGciOiJIUzI1NiIs...',
	})
	secret: string;

	@ApiProperty({
		description: 'Session token for storage authentication',
		example: 'eyJhbGciOiJIUzI1NiIs...',
	})
	sessionToken: string;

	@ApiProperty({
		description: 'Storage URL',
		example: 'storage.example.com',
	})
	storageUrl: string;

	@ApiProperty({
		description: 'Owner organization ID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	organizationId: string;

	@ApiProperty({
		description: 'S3 bucket name',
		example: 'snapflow',
	})
	bucket: string;
}
