/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import {
	ENCRYPTED_RECORD_KIND,
	ENCRYPTION_CONTEXT_SCHEMA_VERSION,
} from '../../../infra/encryption/constants/encryption.constants';
import type { EncryptionContext } from '../../../infra/encryption/schemas/encryption.schema';
import { EnvelopeEncryptionService } from '../../../infra/encryption/services/envelope-encryption.service';
import type { VolumeBackup } from '../entities/volume-backup.entity';

@Injectable()
export class VolumeBackupDataKeyService {
	constructor(private readonly encryptionService: EnvelopeEncryptionService) {}

	encrypt(
		dataKey: Buffer,
		organizationId: string,
		artifactId: string,
		backupGeneration: number
	) {
		return this.encryptionService.encrypt(
			dataKey,
			this.encryptionContext(organizationId, artifactId, backupGeneration)
		);
	}

	decrypt(backup: VolumeBackup): string {
		const plaintext = this.encryptionService.decrypt(
			backup.dataKeyCiphertext,
			this.encryptionContext(
				backup.organizationId,
				backup.artifactId,
				backup.backupGeneration
			)
		);
		try {
			return plaintext.toString('base64');
		} finally {
			plaintext.fill(0);
		}
	}

	private encryptionContext(
		organizationId: string,
		artifactId: string,
		backupGeneration: number
	): EncryptionContext {
		return {
			recordKind: ENCRYPTED_RECORD_KIND.VOLUME_BACKUP_DATA_KEY,
			organizationId,
			recordId: artifactId,
			recordVersion: backupGeneration,
			schemaVersion: ENCRYPTION_CONTEXT_SCHEMA_VERSION,
		};
	}
}
