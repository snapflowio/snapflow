/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import { SSH_ACCESS } from '../constants/ssh-access.constants';
import { SshAccess } from '../entities/ssh-access.entity';

export class SshAccessDto {
	@ApiProperty({
		description: 'Unique identifier for the SSH access',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	id: string;

	@ApiProperty({
		description: 'ID of the sandbox this SSH access is for',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	sandboxId?: string;

	@ApiProperty({
		description: 'SSH access token',
		example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
	})
	token: string;

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

	@ApiProperty({
		description: 'When the SSH access was last updated',
		example: '2025-01-01T11:00:00.000Z',
	})
	updatedAt: Date;

	@ApiProperty({
		description: 'SSH command to connect to the sandbox',
		example: 'ssh -p 2222 token@edge.example.com',
	})
	sshCommand: string;

	@ApiProperty({
		description: 'Pinned SSH host public key presented through the Edge relay',
	})
	hostPublicKey: string;

	static from(
		sshAccess: Pick<
			SshAccess,
			'id' | 'sandboxId' | 'token' | 'expiresAt' | 'createdAt' | 'updatedAt'
		>,
		host: string,
		port: number,
		hostPublicKey: string
	): SshAccessDto {
		const dto = new SshAccessDto();
		dto.id = sshAccess.id;
		dto.sandboxId = sshAccess.sandboxId;
		dto.token = sshAccess.token;
		dto.expiresAt = new Date(sshAccess.expiresAt);
		dto.createdAt = new Date(sshAccess.createdAt);
		dto.updatedAt = new Date(sshAccess.updatedAt);
		dto.hostPublicKey = hostPublicKey;
		if (port === SSH_ACCESS.standardPort) {
			dto.sshCommand = `ssh ${sshAccess.token}@${host}`;
		} else {
			dto.sshCommand = `ssh -p ${port} ${sshAccess.token}@${host}`;
		}

		return dto;
	}
}
