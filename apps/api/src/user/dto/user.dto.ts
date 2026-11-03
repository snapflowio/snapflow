/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { User } from '../entities/user.entity';
import { UserPublicKeyDto } from './user-public-key.dto';

@ApiSchema({ name: 'User' })
export class UserDto {
	@ApiProperty({ description: 'User ID' })
	id: string;

	@ApiProperty({ description: 'User name' })
	name: string;

	@ApiProperty({ description: 'User email' })
	email: string;

	@ApiProperty({ description: 'Whether the email address is verified' })
	emailVerified: boolean;

	@ApiProperty({ description: 'User public keys', type: [UserPublicKeyDto] })
	publicKeys: UserPublicKeyDto[];

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt: Date;

	static from(user: User): UserDto {
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			publicKeys: user.publicKeys.map(UserPublicKeyDto.from),
			createdAt: user.createdAt,
		};
	}
}
