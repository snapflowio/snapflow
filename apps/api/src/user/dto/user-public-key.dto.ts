/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { UserPublicKey } from '../entities/user.entity';

@ApiSchema({ name: 'UserPublicKey' })
export class UserPublicKeyDto {
	@ApiProperty({ description: 'Public key' })
	key: string;

	@ApiProperty({ description: 'Key name' })
	name: string;

	static from(publicKey: UserPublicKey): UserPublicKeyDto {
		return { key: publicKey.key, name: publicKey.name };
	}
}
