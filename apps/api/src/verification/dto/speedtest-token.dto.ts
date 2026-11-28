/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SpeedtestTokenKey' })
export class SpeedtestTokenKeyDto {
	@ApiProperty({ description: 'Key ID prefixing every token it signed' })
	keyId: string;

	@ApiProperty({ description: 'Ed25519 public key as SPKI PEM' })
	publicKey: string;
}
