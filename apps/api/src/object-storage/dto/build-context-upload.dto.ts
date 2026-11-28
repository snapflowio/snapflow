/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayMaxSize,
	ArrayMinSize,
	ArrayUnique,
	IsArray,
	Matches,
} from 'class-validator';
import {
	BUILD_CONTEXT_HASH_PATTERN,
	MAXIMUM_BUILD_CONTEXTS,
} from '../constants/build-context.constants';

const EXAMPLE_HASH =
	'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

export class CreateBuildContextUploadsDto {
	@ApiProperty({
		description: 'SHA-256 hex digests of the build context archives',
		type: [String],
		example: [EXAMPLE_HASH],
	})
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(MAXIMUM_BUILD_CONTEXTS)
	@ArrayUnique()
	@Matches(BUILD_CONTEXT_HASH_PATTERN, { each: true })
	hashes: string[];
}

export class ObjectStorageCredentialDto {
	@ApiProperty({ description: 'Temporary access key ID' })
	accessKeyId: string;

	@ApiProperty({ description: 'Temporary secret access key' })
	secretAccessKey: string;

	@ApiProperty({ description: 'Session token sent with every request' })
	sessionToken: string;

	@ApiProperty({ description: 'When the credential stops working' })
	expiresAt: Date;
}

export class BuildContextUploadDto {
	@ApiProperty({ example: EXAMPLE_HASH })
	hash: string;

	@ApiProperty({
		description: 'Object key to upload the archive to',
		example: `123e4567-e89b-12d3-a456-426614174000/${EXAMPLE_HASH}/context.tar`,
	})
	key: string;

	@ApiProperty({
		description: 'Whether the archive is already stored and needs no upload',
	})
	exists: boolean;
}

export class BuildContextUploadsDto {
	@ApiProperty({
		description: 'S3 endpoint URL',
		example:
			'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
	})
	endpoint: string;

	@ApiProperty({ description: 'S3 signing region', example: 'auto' })
	region: string;

	@ApiProperty({
		description: 'Bucket to upload to',
		example: 'snapflow-objects',
	})
	bucket: string;

	@ApiPropertyOptional({
		description:
			'Credential that can upload only the keys of archives that do not exist yet; absent when every archive exists',
		type: ObjectStorageCredentialDto,
	})
	credential?: ObjectStorageCredentialDto;

	@ApiProperty({ type: [BuildContextUploadDto] })
	uploads: BuildContextUploadDto[];
}
