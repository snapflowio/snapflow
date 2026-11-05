/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { DeterministicHmacService } from '../../infra/encryption/services/deterministic-hmac.service';
import { SPEEDTEST_TOKEN } from '../constants/benchmark-policy.constants';
import type { SpeedtestTokenKeyDto } from '../dto/speedtest-token.dto';
import {
	type SpeedtestSigningKey,
	type SpeedtestTokenClaims,
	signSpeedtestToken,
	speedtestSigningKey,
} from '../utils/speedtest-token.util';

const PUBLIC_KEY_TYPE = 'spki';
const PUBLIC_KEY_FORMAT = 'pem';

export interface SpeedtestTokenSubject {
	id: string;
	expiresAt: Date;
}

function signingKey(derived: string): SpeedtestSigningKey {
	const separator = derived.lastIndexOf(SPEEDTEST_TOKEN.KEY_SEPARATOR);
	return speedtestSigningKey(
		derived.slice(0, separator),
		Buffer.from(derived.slice(separator + 1), 'base64url')
	);
}

function claims(
	subject: SpeedtestTokenSubject,
	byteBudget: bigint = SPEEDTEST_TOKEN.BYTE_BUDGET
): SpeedtestTokenClaims {
	return {
		benchmarkId: subject.id,
		expiresAt: subject.expiresAt,
		byteBudget,
	};
}

@Injectable()
export class SpeedtestTokenService {
	constructor(private readonly hmac: DeterministicHmacService) {}

	mint(subject: SpeedtestTokenSubject): string {
		return signSpeedtestToken(this.currentKey(), claims(subject));
	}

	mintExact(subject: SpeedtestTokenSubject, byteBudget: bigint): string {
		return signSpeedtestToken(this.currentKey(), claims(subject, byteBudget));
	}

	candidates(subject: SpeedtestTokenSubject): string[] {
		return this.keys().map((key) => signSpeedtestToken(key, claims(subject)));
	}

	publicKeys(): SpeedtestTokenKeyDto[] {
		return this.keys().map(({ keyId, publicKey }) => ({
			keyId,
			publicKey: publicKey
				.export({ type: PUBLIC_KEY_TYPE, format: PUBLIC_KEY_FORMAT })
				.toString(),
		}));
	}

	private currentKey(): SpeedtestSigningKey {
		return signingKey(
			this.hmac.derive(
				SPEEDTEST_TOKEN.KEY_DERIVATION_DOMAIN,
				SPEEDTEST_TOKEN.KEY_DERIVATION_SUBJECT
			)
		);
	}

	private keys(): SpeedtestSigningKey[] {
		return this.hmac
			.deriveCandidates(
				SPEEDTEST_TOKEN.KEY_DERIVATION_DOMAIN,
				SPEEDTEST_TOKEN.KEY_DERIVATION_SUBJECT
			)
			.map(signingKey);
	}
}
