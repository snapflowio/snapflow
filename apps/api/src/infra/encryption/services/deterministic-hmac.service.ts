/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHmac } from 'node:crypto';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { DETERMINISTIC_HMAC_DOMAIN } from '../constants/encryption.constants';
import { KEYRINGS, type Keyrings } from '../providers/vault-keyrings.provider';
import { keyringBuffers } from '../utils/keyring.util';

@Injectable()
export class DeterministicHmacService implements OnModuleDestroy {
	private readonly currentKeyId: string;
	private readonly keys: Map<string, Buffer>;

	constructor(@Inject(KEYRINGS) { hmac }: Keyrings) {
		this.currentKeyId = hmac.currentKeyId;
		this.keys = keyringBuffers(hmac);
	}

	derive(domain: string, subject: string): string {
		return this.deriveWithKey(this.currentKeyId, domain, subject);
	}

	deriveCandidates(domain: string, subject: string): readonly string[] {
		return [...this.keys.keys()].map((keyId) =>
			this.deriveWithKey(keyId, domain, subject)
		);
	}

	private deriveWithKey(
		keyId: string,
		domain: string,
		subject: string
	): string {
		if (!domain || !subject) {
			throw new Error('HMAC derivation domain and subject are required');
		}
		const key = this.keys.get(keyId);
		if (!key) throw new Error(`HMAC key "${keyId}" is unavailable`);
		const payload = Buffer.from(
			JSON.stringify([DETERMINISTIC_HMAC_DOMAIN, domain, subject]),
			'utf8'
		);
		try {
			const digest = createHmac('sha256', key)
				.update(payload)
				.digest('base64url');
			return `${keyId}.${digest}`;
		} finally {
			payload.fill(0);
		}
	}

	onModuleDestroy(): void {
		for (const key of this.keys.values()) key.fill(0);
		this.keys.clear();
	}
}
