/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Webhook } from 'standardwebhooks';
import {
	ENCRYPTED_RECORD_KIND,
	ENCRYPTION_CONTEXT_SCHEMA_VERSION,
} from '../../infra/encryption/constants/encryption.constants';
import type { EncryptionContext } from '../../infra/encryption/schemas/encryption.schema';
import { EnvelopeEncryptionService } from '../../infra/encryption/services/envelope-encryption.service';
import {
	WEBHOOK_LIMITS,
	WEBHOOK_SECRET_ENCODING,
	WEBHOOK_SECRET_PREFIX,
	WEBHOOK_SIGNATURE_SEPARATOR,
} from '../constants/webhook.constants';
import type { WebhookEndpoint } from '../entities/webhook-endpoint.entity';

type SecretOwner = Pick<WebhookEndpoint, 'id' | 'organizationId'>;

export interface WebhookSignatureInput {
	messageId: string;
	timestamp: Date;
	body: string;
}

@Injectable()
export class WebhookSecretService {
	constructor(private readonly encryption: EnvelopeEncryptionService) {}

	generate(): string {
		return `${WEBHOOK_SECRET_PREFIX}${randomBytes(WEBHOOK_LIMITS.SECRET_BYTES).toString(WEBHOOK_SECRET_ENCODING)}`;
	}

	encrypt(owner: SecretOwner, version: number, secret: string): string {
		const plaintext = Buffer.from(secret, 'utf8');
		try {
			return this.encryption.encrypt(plaintext, this.context(owner, version));
		} finally {
			plaintext.fill(0);
		}
	}

	sign(
		endpoint: Pick<
			WebhookEndpoint,
			| 'id'
			| 'organizationId'
			| 'secretVersion'
			| 'encryptedSecret'
			| 'previousEncryptedSecret'
			| 'previousSecretExpiresAt'
		>,
		input: WebhookSignatureInput
	): string {
		const secrets = [
			this.decrypt(endpoint, endpoint.secretVersion, endpoint.encryptedSecret),
		];
		if (
			endpoint.previousEncryptedSecret &&
			endpoint.previousSecretExpiresAt &&
			endpoint.previousSecretExpiresAt > input.timestamp
		) {
			secrets.push(
				this.decrypt(
					endpoint,
					endpoint.secretVersion - 1,
					endpoint.previousEncryptedSecret
				)
			);
		}
		return secrets
			.map((secret) =>
				new Webhook(secret).sign(input.messageId, input.timestamp, input.body)
			)
			.join(WEBHOOK_SIGNATURE_SEPARATOR);
	}

	private decrypt(
		owner: SecretOwner,
		version: number,
		envelope: string
	): string {
		const plaintext = this.encryption.decrypt(
			envelope,
			this.context(owner, version)
		);
		try {
			return plaintext.toString('utf8');
		} finally {
			plaintext.fill(0);
		}
	}

	private context(owner: SecretOwner, version: number): EncryptionContext {
		return {
			recordKind: ENCRYPTED_RECORD_KIND.WEBHOOK_SIGNING_SECRET,
			organizationId: owner.organizationId,
			recordId: owner.id,
			recordVersion: version,
			schemaVersion: ENCRYPTION_CONTEXT_SCHEMA_VERSION,
		};
	}
}
