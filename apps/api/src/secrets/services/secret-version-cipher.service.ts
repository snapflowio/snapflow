/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BadRequestException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import type { HumanPrincipal } from '../../common/types/platform-principal.types';
import {
	ENCRYPTED_RECORD_KIND,
	ENCRYPTION_CONTEXT_SCHEMA_VERSION,
	ENCRYPTION_ENVELOPE_VERSION,
} from '../../infra/encryption/constants/encryption.constants';
import { encryptedEnvelopeSchema } from '../../infra/encryption/schemas/encryption.schema';
import { EnvelopeEncryptionService } from '../../infra/encryption/services/envelope-encryption.service';
import {
	SECRET_LIMITS,
	SECRET_PROBLEM_CODE,
	SECRET_RESOURCE_VERSION_INITIAL,
} from '../constants/secret.constants';
import { SecretVersion } from '../entities/secret-version.entity';

interface SecretVersionInput {
	organizationId: string;
	secretId: string;
	versionNumber: number;
	value: string;
	principal: HumanPrincipal;
	createdAt: Date;
}

@Injectable()
export class SecretVersionCipherService {
	constructor(private readonly encryption: EnvelopeEncryptionService) {}

	encryptVersion(input: SecretVersionInput): SecretVersion {
		const { organizationId, versionNumber, principal } = input;
		const id = v4();
		const plaintext = Buffer.from(input.value, 'utf8');
		if (plaintext.byteLength > SECRET_LIMITS.VALUE_MAX_BYTES) {
			plaintext.fill(0);
			throw new BadRequestException(
				'Secret value exceeds the maximum byte length'
			);
		}
		try {
			const encryptedEnvelope = this.encryption.encrypt(plaintext, {
				recordKind: ENCRYPTED_RECORD_KIND.WORKLOAD_SECRET_VALUE,
				organizationId,
				recordId: id,
				recordVersion: versionNumber,
				schemaVersion: ENCRYPTION_CONTEXT_SCHEMA_VERSION,
			});
			const envelope = encryptedEnvelopeSchema.parse(
				JSON.parse(encryptedEnvelope)
			);
			const version = new SecretVersion();
			version.id = id;
			version.organizationId = organizationId;
			version.secretId = input.secretId;
			version.version = versionNumber;
			version.envelopeFormatVersion = ENCRYPTION_ENVELOPE_VERSION;
			version.keyEncryptionKeyId = envelope.keyId;
			version.encryptedEnvelope = encryptedEnvelope;
			version.createdByPrincipalType = principal.type;
			version.createdByPrincipalId = principal.id;
			version.resourceVersion = SECRET_RESOURCE_VERSION_INITIAL;
			version.createdAt = input.createdAt;
			version.revokedAt = null;
			return version;
		} finally {
			plaintext.fill(0);
		}
	}

	decryptLoadedVersion(
		organizationId: string,
		version: SecretVersion | null | undefined
	): Buffer {
		if (!version || version.organizationId !== organizationId)
			throw new NotFoundException({
				code: SECRET_PROBLEM_CODE.VERSION_NOT_FOUND,
			});
		if (version.revokedAt) {
			throw new UnprocessableEntityException({
				code: SECRET_PROBLEM_CODE.VERSION_REVOKED,
			});
		}
		return this.encryption.decrypt(version.encryptedEnvelope, {
			recordKind: ENCRYPTED_RECORD_KIND.WORKLOAD_SECRET_VALUE,
			organizationId,
			recordId: version.id,
			recordVersion: version.version,
			schemaVersion: ENCRYPTION_CONTEXT_SCHEMA_VERSION,
		});
	}
}
