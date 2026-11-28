/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { KeyringsProvider } from './providers/vault-keyrings.provider';
import { DeterministicHmacService } from './services/deterministic-hmac.service';
import { EnvelopeEncryptionService } from './services/envelope-encryption.service';
import { KeyEncryptionKeyService } from './services/key-encryption-key.service';

@Module({
	providers: [
		KeyringsProvider,
		KeyEncryptionKeyService,
		EnvelopeEncryptionService,
		DeterministicHmacService,
	],
	exports: [EnvelopeEncryptionService, DeterministicHmacService],
})
export class EncryptionModule {}
