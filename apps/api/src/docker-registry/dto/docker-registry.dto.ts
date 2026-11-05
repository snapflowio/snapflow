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
import { DockerRegistry } from '../entities/docker-registry.entity';
import { RegistryType } from '../enums/registry-type.enum';

@ApiSchema({ name: 'DockerRegistry' })
export class DockerRegistryDto {
	@ApiProperty({
		description: 'Registry ID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	id: string;

	@ApiProperty({
		description: 'Registry name',
		example: 'My Docker Hub',
	})
	name: string;

	@ApiProperty({
		description: 'Registry URL',
		example: 'https://registry.hub.docker.com',
	})
	url: string;

	@ApiProperty({
		description: 'Registry username',
		example: 'username',
	})
	username: string;

	@ApiProperty({
		description: 'Registry project',
		example: 'my-project',
	})
	project: string;

	@ApiProperty({
		description: 'Registry type',
		enum: RegistryType,
		example: RegistryType.INTERNAL,
	})
	registryType: RegistryType;

	@ApiProperty({
		description: 'Creation timestamp',
		example: '2024-01-31T12:00:00Z',
	})
	createdAt: Date;

	@ApiProperty({
		description: 'Last update timestamp',
		example: '2024-01-31T12:00:00Z',
	})
	updatedAt: Date;

	static from(dockerRegistry: DockerRegistry): DockerRegistryDto {
		const dto: DockerRegistryDto = {
			id: dockerRegistry.id,
			name: dockerRegistry.name,
			url: dockerRegistry.url,
			username: dockerRegistry.username,
			project: dockerRegistry.project,
			registryType: dockerRegistry.registryType,
			createdAt: dockerRegistry.createdAt,
			updatedAt: dockerRegistry.updatedAt,
		};

		return dto;
	}
}

@ApiSchema({ name: 'DockerRegistryPage' })
export class DockerRegistryPageDto extends CursorPageDto<DockerRegistryDto> {
	@ApiProperty({ type: DockerRegistryDto, isArray: true })
	declare items: DockerRegistryDto[];
}
