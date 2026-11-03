/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
	REGISTRY_JWK,
	REGISTRY_TOKEN,
} from '../constants/registry-token.constants';

@ApiSchema({ name: 'RegistryJsonWebKey' })
export class RegistryJsonWebKeyDto {
	@ApiProperty({ enum: [REGISTRY_JWK.KEY_TYPE] })
	kty: typeof REGISTRY_JWK.KEY_TYPE = REGISTRY_JWK.KEY_TYPE;

	@ApiProperty({ enum: [REGISTRY_JWK.CURVE] })
	crv: typeof REGISTRY_JWK.CURVE = REGISTRY_JWK.CURVE;

	@ApiProperty({ enum: [REGISTRY_TOKEN.ALGORITHM] })
	alg: typeof REGISTRY_TOKEN.ALGORITHM = REGISTRY_TOKEN.ALGORITHM;

	@ApiProperty({ enum: [REGISTRY_JWK.USE] })
	use: typeof REGISTRY_JWK.USE = REGISTRY_JWK.USE;

	@ApiProperty({ description: 'Key id carried in the token header' })
	kid: string;

	@ApiProperty({ description: 'Base64url Ed25519 public key' })
	x: string;

	constructor(kid: string, x: string) {
		this.kid = kid;
		this.x = x;
	}
}

@ApiSchema({ name: 'RegistryJsonWebKeySet' })
export class RegistryJsonWebKeySetDto {
	@ApiProperty({ type: [RegistryJsonWebKeyDto] })
	keys: RegistryJsonWebKeyDto[];

	constructor(keys: RegistryJsonWebKeyDto[]) {
		this.keys = keys;
	}
}
