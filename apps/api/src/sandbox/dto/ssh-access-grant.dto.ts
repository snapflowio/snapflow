/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import { SshAccess } from '../entities/ssh-access.entity';

export class SshAccessGrantDto {
	@ApiProperty({
		description: 'Unique identifier for the SSH access',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	id: string;

	@ApiProperty({
		description: 'ID of the sandbox this SSH access is for',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	sandboxId: string;

	@ApiProperty({
		description: 'When the SSH access expires',
		example: '2025-01-01T12:00:00.000Z',
	})
	expiresAt: Date;

	@ApiProperty({
		description: 'When the SSH access was created',
		example: '2025-01-01T11:00:00.000Z',
	})
	createdAt: Date;

	static from(
		sshAccess: Pick<SshAccess, 'id' | 'sandboxId' | 'expiresAt' | 'createdAt'>
	): SshAccessGrantDto {
		const dto = new SshAccessGrantDto();
		dto.id = sshAccess.id;
		dto.sandboxId = sshAccess.sandboxId;
		dto.expiresAt = new Date(sshAccess.expiresAt);
		dto.createdAt = new Date(sshAccess.createdAt);
		return dto;
	}
}
